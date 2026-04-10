'use strict';

const LB_TYPES = new Set([
  'LocalBusiness', 'FoodEstablishment', 'Restaurant', 'CafeOrCoffeeShop', 'FastFoodRestaurant',
  'BarOrPub', 'Bakery', 'IceCreamShop', 'Pizza', 'Winery', 'Brewery', 'Hotel', 'LodgingBusiness',
  'MedicalBusiness', 'Dentist', 'Hospital', 'Pharmacy', 'Physician', 'Optician',
  'HealthAndBeautyBusiness', 'BeautySalon', 'DaySpa', 'HairSalon', 'NailSalon', 'TattooParlor',
  'AutomotiveBusiness', 'AutoBodyShop', 'AutoDealer', 'AutoPartsStore', 'AutoRepair',
  'GasStation', 'MotorcycleDealer', 'MotorcycleRepair',
  'HomeAndConstructionBusiness', 'Electrician', 'GeneralContractor', 'HVACBusiness',
  'HousePainter', 'Locksmith', 'MovingCompany', 'Plumber', 'RoofingContractor',
  'LegalService', 'Attorney', 'Notary',
  'FinancialService', 'AccountingService', 'AutomatedTeller', 'BankOrCreditUnion',
  'InsuranceAgency',
  'RealEstateAgent', 'Store', 'ClothingStore', 'ComputerStore', 'ConvenienceStore',
  'DepartmentStore', 'ElectronicsStore', 'Florist', 'FurnitureStore', 'GardenStore',
  'GroceryStore', 'HardwareStore', 'HobbyShop', 'HomeGoodsStore', 'JewelryStore',
  'LiquorStore', 'MensClothingStore', 'MobilePhoneStore', 'MovieRentalStore', 'MusicStore',
  'OfficeEquipmentStore', 'OutletStore', 'PawnShop', 'PetStore', 'ShoeStore',
  'SportingGoodsStore', 'TireShop', 'ToyStore', 'WholesaleStore', 'WomensClothingStore',
  'SportsActivityLocation', 'Gym', 'PublicSwimmingPool', 'TennisComplex',
  'EntertainmentBusiness', 'AmusementPark', 'ArtGallery', 'Casino', 'ComedyClub',
  'MovieTheater', 'NightClub', 'MusicVenue',
  'ProfessionalService', 'EmploymentAgency', 'LibrarySystem',
]);

function technicalBusinessHoursAudit($, html) {
  const scripts = $('script[type="application/ld+json"]');

  if (scripts.length === 0) {
    return {
      name: '[Technical] Business Hours',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No JSON-LD structured data found.',
      recommendation:
        'Add a LocalBusiness schema with openingHoursSpecification. Business hours in structured data ' +
        'enable rich results on Google Search and help Google Business Profile stay in sync.',
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
      name: '[Technical] Business Hours',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No LocalBusiness schema found — cannot check for business hours.',
      recommendation:
        'Add a LocalBusiness JSON-LD block. Include openingHoursSpecification with ' +
        'dayOfWeek, opens, and closes for each day you operate.',
    };
  }

  // openingHoursSpecification (preferred, structured)
  const ohs = localBiz.openingHoursSpecification;
  if (ohs) {
    const entries = Array.isArray(ohs) ? ohs : [ohs];
    const count = entries.length;
    if (count >= 3) {
      return {
        name: '[Technical] Business Hours',
        status: 'pass',
        score: 100,
        maxScore: 100,
        message: `Business hours defined via openingHoursSpecification (${count} entr${count === 1 ? 'y' : 'ies'}).`,
        details: 'Using structured openingHoursSpecification — optimal for rich results.',
      };
    }
    return {
      name: '[Technical] Business Hours',
      status: 'warn',
      score: 80,
      maxScore: 100,
      message: `openingHoursSpecification present but only ${count} entr${count === 1 ? 'y' : 'ies'} — consider adding all operating days.`,
      recommendation:
        'Add an openingHoursSpecification entry for every day you operate. Each entry should include ' +
        'dayOfWeek (e.g. "Monday"), opens ("09:00"), and closes ("17:00").',
    };
  }

  // openingHours (legacy string or array)
  const oh = localBiz.openingHours;
  if (oh) {
    const entries = Array.isArray(oh) ? oh : [oh];
    return {
      name: '[Technical] Business Hours',
      status: 'warn',
      score: 60,
      maxScore: 100,
      message: `Business hours present via legacy openingHours format (${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}).`,
      details: `Value: ${entries.slice(0, 3).join(', ')}${entries.length > 3 ? '…' : ''}`,
      recommendation:
        'Upgrade from openingHours strings to openingHoursSpecification objects. The structured format ' +
        'supports special hours, holiday overrides, and is preferred by Google for rich results.',
    };
  }

  return {
    name: '[Technical] Business Hours',
    status: 'fail',
    score: 25,
    maxScore: 100,
    message: 'LocalBusiness schema found but no business hours defined.',
    recommendation:
      'Add openingHoursSpecification to your LocalBusiness schema. Include dayOfWeek, opens, and closes ' +
      'for each operating day. This enables hours to appear directly in Google Search results.',
  };
}

module.exports = technicalBusinessHoursAudit;
