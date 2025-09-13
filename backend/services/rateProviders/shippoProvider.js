// Shippo REST provider: quotes shipping rates for multiple parcels
// Required env: SHIPPO_API_TOKEN, ORIGIN_* (see below)

const SHIPPO_API = 'https://api.goshippo.com';

function required(name, value) {
  if (!value) throw new Error(`Missing required config: ${name}`);
  return value;
}

function mapCurrencyByCountry(country) {
  const c = (country || 'US').toUpperCase();
  if (c === 'US') return 'USD';
  if (c === 'CA') return 'CAD';
  if (['GB', 'UK'].includes(c)) return 'GBP';
  if (['DE','FR','ES','IT','NL','SE','DK','IE','PT','FI','BE','AT','LU','GR','CY','MT','SI','SK','LV','LT','EE','CZ','PL','HU','RO','BG','HR'].includes(c)) return 'EUR';
  return 'USD';
}

function buildOrigin() {
  return {
    name: process.env.ORIGIN_NAME || 'ShopBrain Warehouse',
    street1: required('ORIGIN_ADDRESS1', process.env.ORIGIN_ADDRESS1),
    city: required('ORIGIN_CITY', process.env.ORIGIN_CITY),
    state: process.env.ORIGIN_STATE || process.env.ORIGIN_PROVINCE || '',
    zip: required('ORIGIN_POSTAL_CODE', process.env.ORIGIN_POSTAL_CODE),
    country: required('ORIGIN_COUNTRY', process.env.ORIGIN_COUNTRY || 'US'),
    phone: process.env.ORIGIN_PHONE || '0000000000',
  };
}

function buildDestination(dest) {
  return {
    name: dest?.name || 'Customer',
    street1: dest?.address1 || 'Address Provided At Checkout',
    city: dest?.city || '',
    state: dest?.province || dest?.state || '',
    zip: dest?.postal_code || dest?.zip || '',
    country: (dest?.country || 'US').toUpperCase(),
    phone: dest?.phone || '0000000000',
  };
}

function toParcels(boxes) {
  return boxes.map((b) => {
    const dim = b.dimensions || { length: 12, width: 9, height: 4 };
    const weight = Math.max(b.weight || 1, 0.1);
    return {
      length: Number(dim.length) || 6,
      width: Number(dim.width) || 4,
      height: Number(dim.height) || 2,
      distance_unit: 'in',
      weight: Number(weight),
      mass_unit: 'lb',
    };
  });
}

async function shippoFetch(path, options) {
  const token = required('SHIPPO_API_TOKEN', process.env.SHIPPO_API_TOKEN);
  const res = await fetch(`${SHIPPO_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `ShippoToken ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Shippo ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

module.exports = {
  async quote({ boxes, destination }) {
    // Build payload
    const address_from = buildOrigin();
    const address_to = buildDestination(destination);
    const parcels = toParcels(boxes);

    const body = {
      address_from,
      address_to,
      parcels,
      async: false,
    };

    const data = await shippoFetch('/shipments', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const rates = Array.isArray(data?.rates) ? data.rates : [];
    // Normalize
    const out = rates.map((r) => ({
      service_code: `${r.provider}_${r.servicelevel?.token || r.servicelevel?.name}`.toUpperCase(),
      service_name: `${r.provider} ${r.servicelevel?.name || r.servicelevel?.token}`.trim(),
      currency: r.currency || mapCurrencyByCountry(address_to.country),
      total: Number(r.amount),
      eta: r.estimate_days || null,
    }))
    // Sort by price
    .sort((a, b) => a.total - b.total);

    return out;
  },
};
