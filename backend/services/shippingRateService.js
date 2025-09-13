const staticLocal = require('./rateProviders/staticLocalCarriers');
let shippoProvider = null;
try { shippoProvider = require('./rateProviders/shippoProvider'); } catch {}

class ShippingRateService {
  constructor(opts = {}) {
    const prefer = (opts.providerName || process.env.RATE_PROVIDER || '').toLowerCase();
    const hasShippo = !!process.env.SHIPPO_API_TOKEN && !!shippoProvider;
    if (prefer === 'shippo' && hasShippo) {
      this.provider = shippoProvider;
    } else if (hasShippo) {
      this.provider = shippoProvider;
    } else {
      this.provider = staticLocal;
    }
  }

  // boxes: array of { boxId, type, items, weight, cost, utilization }
  // destination: { country, postal_code, province, city }
  async quoteForPackingPlan(boxes, destination) {
    // Augment boxes with rough dimensions if missing; try to map from boxId common names
    const dimMap = {
      envelope: { length: 12, width: 9, height: 1 },
      small: { length: 10, width: 7, height: 4 },
      medium: { length: 14, width: 10, height: 6 },
      large: { length: 18, width: 14, height: 8 },
      xlarge: { length: 24, width: 18, height: 12 },
    };
    const enriched = boxes.map((b) => ({
      ...b,
      dimensions: dimMap[b.boxId] || dimMap[b.type?.toLowerCase?.()] || dimMap.medium,
    }));

  const quotes = await this.provider.quote({ boxes: enriched, destination });
    return quotes;
  }
}

module.exports = ShippingRateService;
