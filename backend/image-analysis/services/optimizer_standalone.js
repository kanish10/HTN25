#!/usr/bin/env node
/**
 * Stand-alone Shipping Optimizer (paste-in-ready)
 * ------------------------------------------------
 * - Greedy multi-box packer with rotation
 * - Layered packing: 3D -> layers by height; inside each layer uses 2D guillotine
 * - Picks best box mix with a "martianScore" (weighted) objective.
 *
 * Usage:
 *   node optimizer_standalone.js --input sample_input.json
 *   node optimizer_standalone.js --input sample_input.json --pretty
 *
 * Exports (for later import into your project):
 *   module.exports = { optimizeShipment }
 */

const fs = require('fs');
const path = require('path');

/* ========================= Utils ========================= */

const permutes3 = (dims) => {
  const [a,b,c] = dims;
  return [
    [a,b,c],[a,c,b],
    [b,a,c],[b,c,a],
    [c,a,b],[c,b,a]
  ];
};

const vol = ({length, width, height}) => length*width*height;

const clone = (o) => JSON.parse(JSON.stringify(o));

const round2 = (x) => Math.round(x*100)/100;

/* ==================== 2D Guillotine Packer ====================
   Pack rectangles (w x l) into a W x L sheet.
   We use a simple "guillotine" split heuristic:
   - Maintain a list of free rectangles.
   - On placement, split the chosen free rect horizontally or vertically.
   - First-fit + best-area-choice.
   This is fast and good enough for hackathon-grade accuracy.
================================================================= */

function pack2DGuillotine(sheetW, sheetL, rects) {
  // rects: [{id, w, l}]  (already chosen height/orientation at layer)
  // returns: {placed: [{id,x,y,w,l}], failed: [id], usedArea}
  const free = [{x:0,y:0,w:sheetW,l:sheetL}];
  const placed = [];
  let usedArea = 0;

  const placeRect = (r) => {
    // First-fit with minimal leftover area
    let bestIdx = -1;
    let bestWaste = Infinity;
    for (let i=0;i<free.length;i++) {
      const fr = free[i];
      if (r.w <= fr.w && r.l <= fr.l) {
        const waste = (fr.w*fr.l) - (r.w*r.l);
        if (waste < bestWaste) { bestWaste = waste; bestIdx = i; }
      }
    }
    if (bestIdx === -1) return false;

    const fr = free[bestIdx];

    placed.push({
        id: r.id,
        x: fr.x,
        y: fr.y,
        w: r.w,
        l: r.l,
        _it: r._it,   // <— keep reference to original item
        _o: r._o      // <— keep chosen orientation (l,w,h)
    });
    usedArea += (r.w*r.l);

    // Split the free rect (simple heuristic: split by the larger leftover)
    const right = { x: fr.x + r.w, y: fr.y, w: fr.w - r.w, l: r.l };
    const bottom = { x: fr.x, y: fr.y + r.l, w: fr.w, l: fr.l - r.l };

    // Remove used
    free.splice(bestIdx,1);
    // Add non-empty
    if (right.w > 0 && right.l > 0) free.push(right);
    if (bottom.w > 0 && bottom.l > 0) free.push(bottom);

    // Optional: simple free-rect merge (skip for speed)
    return true;
  };

  const failed = [];
  for (const r of rects) {
    if (!placeRect(r)) failed.push(r.id);
  }

  return { placed, failed, usedArea };
}

/* ==================== Layered 3D Packer ====================
   Given a box (L,W,H) and a set of items with dims + weight, we:
   1) Sort items by volume descending.
   2) For each item, try orientations; pick one with height <= remaining layer height (start with new layer if needed).
   3) For a layer height h, we 2D-pack base rectangles (w x l) on the sheet (W x L).
   4) Repeat layers until box height is exceeded or items done.
================================================================= */

function tryPackInBox(box, items) {
  // box: {id, cost, length, width, height, maxWeight}
  // items: [{id, length,width,height, weight, qty}]

  // SMART QUANTITY HANDLING: Try to pack multiple identical items efficiently
  // First, attempt to pack items with their full quantities
  let remaining = [];
  items.forEach(it => {
    if (it.qty <= 4 && areItemsIdentical([it])) {
      // For small quantities of identical items, try to pack them together first
      remaining.push({...it}); // Keep original quantity for better packing
    } else {
      // For large quantities or mixed items, expand normally
      for (let i=0;i<it.qty;i++) remaining.push({...it, qty:1});
    }
  });

  // Helper function to check if items are identical (same dimensions)
  function areItemsIdentical(itemsToCheck) {
    if (itemsToCheck.length <= 1) return true;
    const first = itemsToCheck[0];
    return itemsToCheck.every(item =>
      item.length === first.length &&
      item.width === first.width &&
      item.height === first.height
    );
  }

  // sort by volume desc
  remaining.sort((a,b)=> vol(b)-vol(a));

  const placements = []; // per item: {id, boxLayer, x,y,z, dims:{l,w,h}}
  let currentZ = 0;
  let totalWeight = 0;
  const boxVol = vol(box);
  let usedVol = 0;

  while (remaining.length > 0 && currentZ < box.height - 1e-9) {
    // Pick a set of items that share the same chosen height (h) for this layer
    // Greedy: try to pick next item's orientation that leaves the most base area
    const layerItems = [];
    let chosenH = null;

    // We will iterate once over remaining and try to include as many as can share chosenH
    const consider = [];
    for (const it of remaining) {
      // choose the orientation that maximizes base (w*l) while keeping height minimal
      let best = null;
      for (const [l,w,h] of permutes3([it.length, it.width, it.height])) {
        if (h <= (box.height - currentZ + 1e-9) && l <= box.length && w <= box.width) {
          // base area
          const base = l*w;
          if (!best || (h < best.h) || (h===best.h && base>best.base)) {
            best = { l,w,h,base };
          }
        }
      }
      if (best) consider.push({ it, orient:best });
    }

    if (consider.length === 0) break; // nothing fits in remaining height

    // choose layer height as the modal/minimal h among candidates
    consider.sort((a,b)=> a.orient.h - b.orient.h || b.orient.base - a.orient.base);
    chosenH = consider[0].orient.h;

    // gather all items that can take height = chosenH (exact match or close) and pack them in 2D
    const layerRects = [];
    const chosenIds = new Set();

    for (const c of consider) {
      if (Math.abs(c.orient.h - chosenH) < 1e-9) {

        // HANDLE QUANTITIES: Create multiple rectangles for items with qty > 1
        const quantity = c.it.qty || 1;
        for (let i = 0; i < quantity; i++) {
          layerRects.push({
              id: c.it.id + '#' + i + '#' + Math.random().toString(36).slice(2,4),
              w: c.orient.w,
              l: c.orient.l,
              _it: c.it,
              _o: c.orient,
              _qtyIndex: i // Track which instance of the quantity this is
          });
        }

        chosenIds.add(c.it);
      }
    }

    // 2D pack on (box.width x box.length)
    const res = pack2DGuillotine(box.width, box.length, layerRects);

    // Place those that succeeded
    const placedIds = new Set(res.placed.map(p => p.id));
    let placedCount = 0;
    for (const p of res.placed) {
      const it = p._it; const o = p._o;
      placements.push({
        id: it.id,
        boxLayer: currentZ,
        x: p.x, y: p.y, z: currentZ,
        dims: { length:o.l, width:o.w, height:o.h }
      });
      totalWeight += it.weight; // Weight per individual item (correct)
      usedVol += (o.l*o.w*o.h); // Volume per individual item (correct)
      placedCount++;
    }

    // Remove placed items from remaining (match by id and dims/weight quickly)
    if (placedCount > 0) {
      const toRemove = new Set(res.placed.map(p => p._it.__rmKey = p._it.__rmKey || Math.random()));
      // tag originals
      for (const p of res.placed) p._it.__rmKey = p._it.__rmKey || Math.random();
      remaining = remaining.filter(it => !toRemove.has(it.__rmKey));
      currentZ += chosenH; // advance one layer
    } else {
      // No one actually placed (guillotine failure)—to avoid infinite loop, push layer up by the smallest feasible item height
      const minH = Math.min(...consider.map(c=>c.orient.h));
      if (!isFinite(minH) || minH <= 0) break;
      currentZ += minH;
    }

    if (totalWeight > box.maxWeight + 1e-9) {
      // weight overflow: fail signal
      return { ok:false, reason:'weight_exceeded' };
    }
  }

  return {
    ok: true,
    placements,
    usedVolume: usedVol,
    totalWeight,
    voidRatio: Math.max(0, 1 - usedVol/boxVol)
  };
}

/* ==================== “Martian” Scoring Layer ====================
   For now this is a local weighted scorer.
   Later, replace martianScore() body with the real API call.
=================================================================== */

function martianScore(features, weights) {
  // features: { cost, voidRatio, dimWeight, boxCount }
  // weights:  { cost, void, dim, count }  (non-negative; higher = more important)
  const w = Object.assign({cost:0.5, void:0.25, dim:0.15, count:0.1}, weights||{});
  // Normalize into 0..1 desirability where lower is better
  const costN = features.cost;              // already monetary, will be scaled per plan
  const voidN = features.voidRatio;         // 0..1
  const dimN  = features.dimWeight;         // lb/kg; scaled per plan
  const cntN  = features.boxCount;          // integer

  // We’ll min-max scale cost & dim across candidate plans later. For now return linear comb; final scaling done in chooseBestPlan().
  return w.cost*costN + w.void*voidN + w.dim*dimN + w.count*cntN;
}

/* ==================== Main Optimizer ==================== */

function optimizeShipment(input) {
  const data = clone(input);
  const boxes = data.boxes.map(b => ({
    id: b.id,
    cost: +b.cost,
    length: +b.innerDims.length,
    width:  +b.innerDims.width,
    height: +b.innerDims.height,
    maxWeight: +b.maxWeight
  }));

  const items = data.products.map(p => ({
    id: p.id,
    length:+p.dimensions.length,
    width:+p.dimensions.width,
    height:+p.dimensions.height,
    weight:+p.weight,
    qty: +p.quantity
  }));

  // SMART QUANTITY HANDLING: Keep items with quantity > 1 grouped for better packing
  // Only expand when the 3D packing algorithm specifically needs individual items
  const itemList = items.map(it => ({...it})); // Keep original quantities
  itemList.sort((a,b)=> (vol(b) * b.qty) - (vol(a) * a.qty)); // Sort by total volume (vol * qty)

  // Greedy multi-bin: keep packing remaining items by trying each box type; choose the box that packs the most with best score
  let remaining = itemList;
  const chosen = [];

  while (remaining.length > 0) {
    // Try all box types on current remaining set; pick best partial pack
    const trials = [];
    for (const b of boxes) {
      const pack = tryPackInBox(b, remaining);
      if (!pack.ok || pack.placements.length === 0) continue;

      const dimWeight = Math.max(
        (b.length*b.width*b.height) / (data.options?.dimDivisor || 5000), // e.g., 5000 cm^3/kg or 139 in^3/lb
        pack.totalWeight
      );

      const trial = {
        box: b,
        pack,
        features: {
          cost: b.cost,
          voidRatio: pack.voidRatio,
          dimWeight: dimWeight,
          boxCount: 1
        }
      };
      trials.push(trial);
    }

    if (trials.length === 0) {
      // Nothing fits in any box -> fail hard on first remaining item; recommend next-larger custom box
      const first = remaining[0];
      const suggestion = {
        id: 'CUSTOM_NEXT_UP',
        cost: (data.options?.customBoxBaseCost || 2.0),
        length: first.length + 2,
        width: first.width + 2,
        height: first.height + 2,
        maxWeight: Math.max(first.weight*2, 5)
      };
      const pack = tryPackInBox(suggestion, [first]);
      if (!pack.ok) throw new Error('Item does not fit even in custom suggestion.');
      chosen.push({ box: suggestion, pack });
      remaining = remaining.slice(1);
      continue;
    }

    // Scale-sensitive choose: min-max scale cost & dim across trials, then score
    const minCost = Math.min(...trials.map(t=>t.features.cost));
    const maxCost = Math.max(...trials.map(t=>t.features.cost));
    const minDim  = Math.min(...trials.map(t=>t.features.dimWeight));
    const maxDim  = Math.max(...trials.map(t=>t.features.dimWeight));
    for (const t of trials) {
      const cS = (t.features.cost - minCost) / Math.max(1e-9, (maxCost - minCost));
      const dS = (t.features.dimWeight - minDim) / Math.max(1e-9, (maxDim - minDim));
      t._scaled = { cost: cS, void: t.features.voidRatio, dim: dS, count: 0 };
      t.score = martianScore(t._scaled, data.options?.weights);
    }

    trials.sort((a,b)=> a.score - b.score);
    const best = trials[0];
    chosen.push(best);

    // Remove the placed SKUs from remaining
    const placedKeys = new Set(best.pack.placements.map((p,i)=> (p._key = p.id + '|' + i)));
    // We don't have original keys; match by consuming counts of IDs
    const placedById = {};
    for (const p of best.pack.placements) placedById[p.id] = (placedById[p.id]||0) + 1;

    const newRemaining = [];
    const consumedIdCount = {};
    for (const it of remaining) {
      const c = consumedIdCount[it.id] || 0;
      if ((placedById[it.id]||0) > c) {
        consumedIdCount[it.id] = c + 1; // consume one
      } else {
        newRemaining.push(it);
      }
    }
    remaining = newRemaining;
  }

  // Summarize plan
  const shipments = [];
  let totalCost = 0;
  let totalBoxes = 0;
  let totalDimWeight = 0;
  let totalWeight = 0;

  for (const c of chosen) {
    const b = c.box;
    const p = c.pack;
    totalBoxes += 1;
    totalCost += b.cost;
    totalWeight += p.totalWeight;
    const dimW = Math.max(
      (b.length*b.width*b.height) / (data.options?.dimDivisor || 5000),
      p.totalWeight
    );
    totalDimWeight += dimW;

    const boxVol = b.length*b.width*b.height;
    const fillPct = boxVol > 0 ? (p.usedVolume / boxVol) * 100 : 0;

    shipments.push({
    boxId: b.id,
    cost: round2(b.cost),
    innerDims: { length:b.length, width:b.width, height:b.height },
    boxVolume: round2(boxVol),                  // NEW
    usedVolume: round2(p.usedVolume),
    fillPercent: round2(fillPct),               // NEW
    voidRatio: Math.round(p.voidRatio*10000)/10000, // more precision
    packedWeight: round2(p.totalWeight),
    dimChargeableWeight: round2(dimW),
    items: p.placements.map(pp => ({
        id: pp.id,
        pos: { x:round2(pp.x), y:round2(pp.y), z:round2(pp.boxLayer) },
        dims: { length:pp.dims.length, width:pp.dims.width, height:pp.dims.height }
    }))
    });

    
  }

  const plan = {
    summary: {
      totalBoxes,
      totalCost: round2(totalCost),
      totalActualWeight: round2(totalWeight),
      totalChargeableWeight: round2(totalDimWeight)
    },
    shipments
  };

  return plan;
}

/* ==================== CLI ==================== */

function readArg(flag, def=null) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return def;
  return process.argv[i+1] || def;
}

if (require.main === module) {
  const inputPath = readArg('--input');
  const pretty = process.argv.includes('--pretty');
  if (!inputPath) {
    console.error('Usage: node optimizer_standalone.js --input file.json [--pretty]');
    process.exit(1);
  }
  const inAbs = path.resolve(process.cwd(), inputPath);
  const data = JSON.parse(fs.readFileSync(inAbs,'utf8'));
  const plan = optimizeShipment(data);
  const outStr = pretty ? JSON.stringify(plan, null, 2) : JSON.stringify(plan);
  console.log(outStr);
}

// --- Add near the top (helpers) ---
function toNum(x) { const n = parseFloat(x); return Number.isFinite(n) ? n : NaN; }
function inchesFrom(v, unit) { return unit === 'cm' ? toNum(v)/2.54 : toNum(v); }
function poundsFrom(v, unit) { return unit === 'kg' ? toNum(v)*2.2046226218 : toNum(v); }

// --- Add: normalize Gemini item(s) -> optimizer products[] ---
function normalizeGeminiItems(geminiPayload) {
  const arr = Array.isArray(geminiPayload) ? geminiPayload : [geminiPayload];
  return arr.map(g => {
    const lu = (g.units && g.units.length) || g.lengthUnit || 'in';
    const wu = (g.units && g.units.weight) || g.weightUnit || 'lb';

    const L = inchesFrom(g?.dimensions?.length, lu);
    const W = inchesFrom(g?.dimensions?.width,  lu);
    const H = inchesFrom(g?.dimensions?.height, lu);
    const weight = poundsFrom(g?.estimatedWeight ?? g?.weight, wu);
    const qty = Number(g?.quantity ?? 1);

    if (![L,W,H,weight].every(Number.isFinite)) {
      throw new Error('Gemini item missing/invalid numeric dimensions or weight');
    }

    const id = String(g?.suggestedName || g?.productType || 'product')
      .toLowerCase().replace(/\s+/g,'-');

    return {
      id,
      dimensions: { length: L, width: W, height: H },
      weight,
      quantity: qty
    };
  });
}

// --- Add: public entry that accepts Gemini specs directly ---
function optimizeFromGemini(geminiPayload, boxCatalog, options = {}) {
  const products = normalizeGeminiItems(geminiPayload);
  const input = {
    boxes: boxCatalog,
    products,
    options: {
      dimDivisor: options.dimDivisor ?? 139, // in³/lb; set 5000 if you’re using cm/kg
      weights: options.weights ?? { cost:0.6, void:0.25, dim:0.1, count:0.05 },
      shipTogether: options.shipTogether ?? 'auto' // 'auto'|'if_possible'|'always'
    }
  };
  return optimizeShipment(input); // existing function
}

module.exports = {
  optimizeShipment,
  pack2DGuillotine,
  tryPackInBox,
  martianScore,
  optimizeFromGemini,
  normalizeGeminiItems
};
