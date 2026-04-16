function metaDescriptionAudit($) {
  const desc = $('meta[name="description"]').attr('content') || '';
  const trimmed = desc.trim();

  if (!trimmed) {
    return {
      name: '[Content] Meta Description',
      status: 'fail',
      message: 'No meta description found.',
      recommendation: 'Add a meta description in your page\'s <head>: <meta name="description" content="Your summary here.">. Write it as a compelling 70–160 character summary of the page — this is what appears under your title in Google search results and directly affects click-through rate.',
    };
  }

  if (trimmed.length < 70) {
    return {
      name: '[Content] Meta Description',
      status: 'warn',
      message: `Meta description is too short (${trimmed.length} chars). Aim for 70–160 characters.`,
      details: trimmed,
      recommendation: 'Expand your meta description to at least 70 characters. A very short description gives search engines and users little context about the page, and Google may replace it with a random excerpt from your content instead.',
    };
  }

  if (trimmed.length > 160) {
    return {
      name: '[Content] Meta Description',
      status: 'warn',
      message: `Meta description is too long (${trimmed.length} chars). Aim for 70–160 characters.`,
      details: trimmed,
      recommendation: 'Trim your meta description to 160 characters or fewer. Google truncates longer descriptions in search results, which can cut off your message mid-sentence. Put your most important information first.',
    };
  }

  return {
    name: '[Content] Meta Description',
    status: 'pass',
    message: `Meta description found (${trimmed.length} chars).`,
    details: trimmed,
  };
}

module.exports = metaDescriptionAudit;
