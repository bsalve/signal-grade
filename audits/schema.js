function schemaAudit($, html) {
  const jsonLdScripts = $('script[type="application/ld+json"]');

  if (jsonLdScripts.length === 0) {
    return {
      name: '[Technical] Structured Data',
      status: 'fail',
      message: 'No JSON-LD structured data found. Add LocalBusiness schema for local SEO.',
      recommendation: 'Add a LocalBusiness JSON-LD block to your page. This tells search engines your business name, address, phone number, and category — essential for local search visibility and Google\'s Knowledge Panel. Use Google\'s Structured Data Markup Helper (search "Google structured data markup helper") to generate the code without writing it by hand.',
    };
  }

  const schemas = [];
  let hasLocalBusiness = false;

  jsonLdScripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const type = data['@type'] || 'Unknown';
      schemas.push(type);
      if (type === 'LocalBusiness' || type.includes('LocalBusiness')) {
        hasLocalBusiness = true;
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  if (!hasLocalBusiness) {
    return {
      name: '[Technical] Structured Data',
      status: 'warn',
      message: 'Structured data found but no LocalBusiness schema detected.',
      details: `Found types: ${schemas.join(', ')}`,
      recommendation: 'Add a LocalBusiness schema (or a specific subtype like Restaurant, MedicalBusiness, LegalService, etc.) alongside your existing structured data. LocalBusiness schema is what powers local search features like your address and hours appearing directly in Google results.',
    };
  }

  return {
    name: '[Technical] Structured Data',
    status: 'pass',
    message: 'LocalBusiness structured data found.',
    details: `Found types: ${schemas.join(', ')}`,
  };
}

module.exports = schemaAudit;
