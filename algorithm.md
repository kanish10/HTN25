What problem are we solving?
You’re solving a classic 3-D bin packing / container loading problem: place rectangular items (products) into one or more rectangular boxes (containers) with axis-aligned rotations, respecting box dimensions and max weight, while keeping shipping cost (incl. dimensional weight) low and the void (empty) space small. This family of problems is NP-hard, so practical systems use heuristics and meta-heuristics rather than exact optimization for real-time use. Good surveys and foundational papers: Martello–Pisinger–Vigo (3D BPP) and many successors; Wäscher–Haussner–Schumann’s typology frames where our variant sits in the C&P landscape. mansci+3JSTOR+3ResearchGate+3
High-level design (how your optimizer works)
Your approach is a fast, explainable pipeline made of three layers:
Layered 3-D packing with rotations (tryPackInBox)


Expand quantities → a flat list of unit items.


Sort items by volume descending (a “decreasing” strategy common in bin packing).


Choose an item height for the current layer (shelf) by scanning each item’s 6 axis-aligned orientations and picking the one with smallest feasible height and largest base area (width×length) at that height.


For all items whose best orientation matches that chosen height, pack their footprints in 2-D on the box floor (length×width) using a guillotine rectangle packer (below).


Commit placed items at z = currentZ, bump currentZ += layerHeight, repeat until out of items or height.


Track used volume, total weight, and void ratio = 1 – usedVolume/boxVolume.


Rationale: “Layer/shelf” or “level” heuristics are a well-studied, fast class for 3-D packing—simple to reason about and good for mixed SKU flows. Many 3-D methods decompose to 2-D or 1-D subproblems to keep complexity manageable. Alternatives include extreme-point placements and wall-building; you’ve chosen a shelf/layer route for simplicity+speed. cirrelt.ca+2SciSpace+2


2-D guillotine packer for each layer (pack2DGuillotine)


Maintains a list of free rectangles on the layer sheet (box width×length).


For each rectangle item (w×l), uses first-fit with “best leftover area”: pick the free rect that fits and leaves the least waste.


After placement, split the used free rect with guillotine cuts (edge-to-edge vertical/horizontal splits) into “right” and “bottom” sub-rectangles and append them to the free list.


Rationale: Guillotine constraints mirror how real cutters or conceptual “slices” operate and are widely studied in the 2-D cutting/packing literature; they’re fast and pair naturally with shelves. Your heuristic (first-fit + best-area split) is a common, explainable baseline seen in surveys of guillotine heuristics. ScienceDirect+2amsdottorato.unibo.it+2


Multi-box selection with a weighted objective (“Martian score”) (optimizeShipment + martianScore)


While items remain, try packing them in each candidate box type (inner dimensions and max weight).


For each trial: compute features


monetary cost of that box,


voidRatio from the 3-D pack,


dimensional weight vs actual weight (chargeable weight = max(dim-weight, actual weight)),


boxCount (here always 1 per trial).


Min-max normalize cost and dim-weight across the trials to make scales comparable, then take a weighted sum (your “martianScore”).


Pick the lowest score (best trade-off), remove the items it placed from the remaining set, and loop.


Rationale: This is a straightforward multi-criteria decision using the Weighted Sum Model (WSM)—industry-friendly, tunable, and easy to explain. You normalize so differing units (dollars, ratios, pounds) are comparable; the weights reflect business priorities (e.g., emphasize shipping spend vs. box utilization). In the literature this is standard MCDM practice; your “Martian” is currently a local scorer but could be replaced by a learned model later. (Surveys discuss WSM/MCDA widely.) ScienceDirect


Why dimensional weight shows up (and why 139 or 5000?)
Carriers bill by max(actual weight, dimensional weight).
Imperial: dim-weight = (L×W×H in inches) / 139 for US domestic (typical in 2025; carriers periodically tweak rounding rules).


Metric: often (cm³)/5000 gives kg.
 Your code supports both via options.dimDivisor (defaults to 5000), and the example in your comments mentions 139 in³/lb. For references straight from FedEx (dim-weight concept and cm³/kg divisor) and recent rule/rounding updates, see: FedEx pages + analyses of recent 139-divisor & rounding changes. transportationinsight.com+3FedEx+3FedEx+3


Where each idea maps to code
Rotations (6 orientations): permutes3(); tried inside tryPackInBox() when choosing layer height.


Item ordering: remaining.sort((a,b)=> vol(b)-vol(a)).


Layer formation: pick chosenH (smallest feasible height / largest base), collect items matching that height into layerRects, then 2-D pack them.


2-D pack: pack2DGuillotine(box.width, box.length, layerRects) with free-rect splitting (“right” and “bottom”).


Weight constraint: check totalWeight > box.maxWeight.


If nothing fits any box: propose a custom next-up box (+2 units each side) as a graceful fallback.


Objective: for each trial, build features = { cost, voidRatio, dimWeight, boxCount }; min-max scale cost + dimWeight across trials → _scaled, then score with martianScore(); pick the best.


Plan summary: totals, per-box fillPercent, voidRatio, chargeable weight, and per-item placements (x,y,z and oriented dims) for downstream rendering.


How this fits in the research landscape (what to say if asked “why this heuristic?”)
Problem hardness: 3-D BPP is strongly NP-hard; exact MIP/branch-and-bound is too slow for interactive flows. Heuristics (decreasing orders, shelves/layers, guillotine splits) are standard and strike a speed/quality balance. JSTOR


Layered (shelf) methods: Well-known in 2-D and extended to 3-D; easy to reason about and parallelize. Extreme-point and wall-building are stronger but more complex; shelves are often chosen when you need quick, stable decisions. cirrelt.ca+1


Guillotine packing: Decades of work show guillotine heuristics are robust and fast for rectangular packing/cutting. They’re also intuitive to visualize (critical for UI and debugging). ScienceDirect+1


Multi-criteria shipping objective: Real bills combine box cost, carrier chargeable weight, and operational concerns like void and box count. Using a weighted, normalized sum is a standard MCDM design that your team (or a learning system) can tune from historical cost/return data. (You can later swap martianScore for a learned regressor or a bandit that optimizes actual landed cost.) ScienceDirect


Industry constraint (DIM rules): The 139 (in³/lb) and 5000 (cm³/kg) divisors and round-up practices are exactly how carriers price; that’s why your objective explicitly accounts for dim-weight. FedEx+2FedEx+2


Strengths, trade-offs, and how to explain them
Strengths
Speed: All steps are greedy or near-linear over items per trial; you can try many box SKUs quickly.


Interpretability: Every choice (rotation, placement, score) is explainable—great for ops review and customer support.


Tunability: Weights in martianScore expose business levers (e.g., cost vs. utilization).


Trade-offs / known limits
Fragmentation: Basic guillotine splitting without free-rect merging can leave slivers (worse utilization). Surveys propose merge/cleanup rules. ScienceDirect


Shelf myopia: Fixing one layer height can block slightly taller but better global layouts; extreme-point methods can improve this at higher complexity. cirrelt.ca


Local objective: Weighted sum is linear; some carriers have zone-based step functions and rounding (to whole lbs/kg or inches) that you may want to model explicitly (you already can, by rounding inside feature calc). transportationinsight.com


Concrete improvements (if Shopify asks “what’s next?”)
Free-rect merging & better split rules in pack2DGuillotine → higher fill. (See guillotine heuristic comparisons.) ScienceDirect


Extreme-point placement option for 3-D (toggleable), which often beats shelves on dense mixes. cirrelt.ca


Meta-heuristics around your greedy core (e.g., Guided Local Search, VNS, or ruin-&-recreate) to refine a first solution without big latency hits. INFORMS Pubs Online+2ScienceDirect+2


Learning-to-rank box choices: replace martianScore with a small model trained on historical landed-cost deltas, keeping the same features for transparency.


Carrier-exact billing: encode round-to-next-inch and any current dim rounding policies so feature costs match invoices 1:1. transportationinsight.com


How to present this to Shopify folks (sound bites)
“We use a layered 3-D packer with 6-way rotations. Each layer is chosen to be as short as possible and area-heavy, then we do a 2-D guillotine layout on the layer. That’s a classic, fast approach in packing literature.” cirrelt.ca+1


“For each candidate box, we compute void, actual weight, and dimensional weight (per carrier rules), then pick the best normalized weighted trade-off. The weights are business knobs we can tune or learn.” FedEx+1


“This is explainable and production-friendly—and we’ve left hooks to upgrade with extreme-point placement or meta-heuristics if we need higher fill on heavy mixes.” cirrelt.ca+1



If you want, I can annotate your file inline with short comments (“why this line exists / what paper it maps to”) or add a one-page “algorithm brief” to hand to judges that cites the key works above in simple language.

{
  "productType": "ring",
  "category": "Jewelry",
  "dimensions": {
    "length": "1.0",
    "width": "1.0",
    "height": "0.6"
  },
  "estimatedWeight": "0.1",
  "material": "gold plated",
  "color": "gold",
  "suggestedName": "Serpentine Coil Ring",
  "suggestedPrice": {
    "min": "19.99",
    "max": "39.99"
  }
}