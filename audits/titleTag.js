function titleTagAudit($) {
  const title = $('title').first().text().trim();

  if (!title) {
    return {
      name: 'Title Tag',
      status: 'fail',
      message: 'No title tag found.',
    };
  }

  if (title.length < 30) {
    return {
      name: 'Title Tag',
      status: 'warn',
      message: `Title tag is too short (${title.length} chars). Aim for 30–60 characters.`,
      details: title,
    };
  }

  if (title.length > 60) {
    return {
      name: 'Title Tag',
      status: 'warn',
      message: `Title tag is too long (${title.length} chars). Aim for 30–60 characters.`,
      details: title,
    };
  }

  return {
    name: 'Title Tag',
    status: 'pass',
    message: `Title tag found (${title.length} chars).`,
    details: title,
  };
}

module.exports = titleTagAudit;
