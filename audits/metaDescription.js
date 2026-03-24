function metaDescriptionAudit($) {
  const desc = $('meta[name="description"]').attr('content') || '';
  const trimmed = desc.trim();

  if (!trimmed) {
    return {
      name: 'Meta Description',
      status: 'fail',
      message: 'No meta description found.',
    };
  }

  if (trimmed.length < 70) {
    return {
      name: 'Meta Description',
      status: 'warn',
      message: `Meta description is too short (${trimmed.length} chars). Aim for 70–160 characters.`,
      details: trimmed,
    };
  }

  if (trimmed.length > 160) {
    return {
      name: 'Meta Description',
      status: 'warn',
      message: `Meta description is too long (${trimmed.length} chars). Aim for 70–160 characters.`,
      details: trimmed,
    };
  }

  return {
    name: 'Meta Description',
    status: 'pass',
    message: `Meta description found (${trimmed.length} chars).`,
    details: trimmed,
  };
}

module.exports = metaDescriptionAudit;
