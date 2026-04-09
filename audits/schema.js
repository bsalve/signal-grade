function schemaAudit($, html) {
  const jsonLdScripts = $('script[type="application/ld+json"]');

  if (jsonLdScripts.length === 0) {
    return {
      name: '[Technical] Structured Data',
      status: 'fail',
      message: 'No JSON-LD structured data found. Add LocalBusiness schema for local SEO.',
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
