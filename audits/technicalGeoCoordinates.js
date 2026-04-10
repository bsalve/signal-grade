'use strict';

const LB_TYPES = new Set([
  'LocalBusiness', 'FoodEstablishment', 'Restaurant', 'CafeOrCoffeeShop', 'FastFoodRestaurant',
  'BarOrPub', 'Bakery', 'Hotel', 'LodgingBusiness', 'MedicalBusiness', 'Dentist', 'Hospital',
  'Pharmacy', 'Physician', 'HealthAndBeautyBusiness', 'BeautySalon', 'HairSalon',
  'AutomotiveBusiness', 'AutoDealer', 'AutoRepair', 'GasStation',
  'HomeAndConstructionBusiness', 'Electrician', 'Plumber', 'Locksmith', 'Roofer',
  'LegalService', 'Attorney', 'FinancialService', 'InsuranceAgency', 'BankOrCreditUnion',
  'RealEstateAgent', 'Store', 'GroceryStore', 'ClothingStore', 'HardwareStore',
  'ProfessionalService', 'Gym', 'EntertainmentBusiness',
]);

function technicalGeoCoordinatesAudit($, html) {
  const scripts = $('script[type="application/ld+json"]');

  if (scripts.length === 0) {
    return {
      name: '[Technical] Geo Coordinates',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No JSON-LD structured data found.',
      recommendation:
        'Add a LocalBusiness schema with a geo property containing GeoCoordinates (latitude and longitude). ' +
        'Precise coordinates help Google confirm your physical location for map pack ranking.',
    };
  }

  let localBiz = null;

  scripts.each((_, el) => {
    if (localBiz) return;
    try {
      const data = JSON.parse($(el).html());
      const objects = data['@graph'] ? data['@graph'] : [data];
      for (const obj of objects) {
        const type = obj['@type'];
        if (!type) continue;
        const types = Array.isArray(type) ? type : [type];
        if (types.some(t => LB_TYPES.has(t) || String(t).includes('LocalBusiness'))) {
          localBiz = obj;
          break;
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  if (!localBiz) {
    return {
      name: '[Technical] Geo Coordinates',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No LocalBusiness schema found — cannot check for geo coordinates.',
      recommendation:
        'Add a LocalBusiness JSON-LD block with a geo property. Include latitude and longitude ' +
        'to help search engines confirm your physical location for local and map pack results.',
    };
  }

  // Check for geo object
  const geo = localBiz.geo;

  // Also accept latitude/longitude flattened directly onto the LocalBusiness object
  const flatLat = localBiz.latitude;
  const flatLong = localBiz.longitude;

  if (!geo && !flatLat && !flatLong) {
    return {
      name: '[Technical] Geo Coordinates',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'LocalBusiness schema found but no geo coordinates defined.',
      recommendation:
        'Add a "geo" property to your LocalBusiness schema: ' +
        '{"@type":"GeoCoordinates","latitude":40.7128,"longitude":-74.0060}. ' +
        'Precise coordinates reduce location ambiguity and improve map pack eligibility.',
    };
  }

  let lat, long;

  if (geo && typeof geo === 'object') {
    lat  = geo.latitude  ?? geo.lat;
    long = geo.longitude ?? geo.long ?? geo.lng;
  } else if (flatLat || flatLong) {
    lat  = flatLat;
    long = flatLong;
  }

  const hasLat  = lat  !== undefined && lat  !== null && String(lat).trim()  !== '';
  const hasLong = long !== undefined && long !== null && String(long).trim() !== '';

  if (hasLat && hasLong) {
    return {
      name: '[Technical] Geo Coordinates',
      status: 'pass',
      score: 100,
      maxScore: 100,
      message: `Geo coordinates found: ${lat}, ${long}.`,
      details: 'latitude and longitude both present in LocalBusiness schema.',
    };
  }

  const missing = [];
  if (!hasLat)  missing.push('latitude');
  if (!hasLong) missing.push('longitude');

  return {
    name: '[Technical] Geo Coordinates',
    status: 'warn',
    score: 50,
    maxScore: 100,
    message: `geo property found but missing: ${missing.join(', ')}.`,
    recommendation:
      `Add the missing coordinate${missing.length > 1 ? 's' : ''} (${missing.join(', ')}) ` +
      'to your geo/GeoCoordinates object. Both latitude and longitude are required.',
  };
}

module.exports = technicalGeoCoordinatesAudit;
