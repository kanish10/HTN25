// Static local carrier rate tables for quick estimates without external APIs
// Simple model: base price + per-pound + oversize surcharge by country and carrier

const tables = {
  US: [
    { code: 'UPS_GROUND', name: 'UPS Ground', base: 6.5, perLb: 0.7, oversizeSurcharge: 4.0 },
    { code: 'USPS_PRIORITY', name: 'USPS Priority', base: 5.2, perLb: 0.9, oversizeSurcharge: 3.0 },
    { code: 'FEDEX_HOME', name: 'FedEx Home Delivery', base: 7.0, perLb: 0.8, oversizeSurcharge: 4.5 },
  ],
  CA: [
    { code: 'CANADA_POST_EXPEDITED', name: 'Canada Post Expedited', base: 9.0, perLb: 1.2, oversizeSurcharge: 5.0 },
    { code: 'PUROLATOR_GROUND', name: 'Purolator Ground', base: 10.0, perLb: 1.1, oversizeSurcharge: 6.0 },
  ],
  GB: [
    { code: 'ROYAL_MAIL_TRACKED_48', name: 'Royal Mail Tracked 48', base: 4.2, perLb: 1.0, oversizeSurcharge: 3.5 },
    { code: 'DPD_LOCAL', name: 'DPD Local', base: 5.0, perLb: 1.1, oversizeSurcharge: 4.0 },
  ],
};

function volumetricWeight(dim) {
  // Simple DIM weight calculation: L*W*H / 139 (inches -> lbs)
  return (dim.length * dim.width * dim.height) / 139;
}

function boxMaxDim(dim) {
  return Math.max(dim.length, dim.width, dim.height);
}

module.exports = {
  quote({ boxes, destination }) {
    const country = (destination?.country || 'US').toUpperCase();
    const carriers = tables[country] || tables.US;

    // For each carrier, sum costs across boxes
    const results = carriers.map((carrier) => {
      let total = 0;
      let breakdown = [];
      for (const box of boxes) {
        const dim = box.dimensions || { length: 12, width: 9, height: 4 }; // fallback
        const weight = Math.max(box.weight || 1, volumetricWeight(dim));
        const oversize = boxMaxDim(dim) > 22; // arbitrary oversize threshold
        const cost = carrier.base + carrier.perLb * weight + (oversize ? carrier.oversizeSurcharge : 0);
        total += cost;
        breakdown.push({ boxId: box.boxId || box.type, weight: Number(weight.toFixed(2)), cost: Number(cost.toFixed(2)) });
      }
      return {
        service_code: carrier.code,
        service_name: carrier.name,
        currency: country === 'US' ? 'USD' : country === 'CA' ? 'CAD' : 'GBP',
        total: Number(total.toFixed(2)),
        breakdown,
      };
    });

    // Sort by total ascending
    results.sort((a, b) => a.total - b.total);
    return results;
  },
};
