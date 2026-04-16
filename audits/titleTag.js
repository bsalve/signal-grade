function titleTagAudit($) {
  const title = $('title').first().text().trim();

  if (!title) {
    return {
      name: '[Content] Title Tag',
      status: 'fail',
      message: 'No title tag found.',
      recommendation: 'Add a <title> tag inside your page\'s <head>. This is the single most important on-page SEO element — it appears as the clickable headline in Google search results. Format it as: Primary Keyword — Business Name, keeping it between 30–60 characters.',
    };
  }

  if (title.length < 30) {
    return {
      name: '[Content] Title Tag',
      status: 'warn',
      message: `Title tag is too short (${title.length} chars). Aim for 30–60 characters.`,
      details: title,
      recommendation: 'Expand your title tag to at least 30 characters. A short title misses keyword opportunities and gives users little reason to click. Try: Primary Keyword — Secondary Keyword | Brand Name.',
    };
  }

  if (title.length > 60) {
    return {
      name: '[Content] Title Tag',
      status: 'warn',
      message: `Title tag is too long (${title.length} chars). Aim for 30–60 characters.`,
      details: title,
      recommendation: 'Shorten your title tag to 60 characters or fewer. Google truncates longer titles in search results, which can cut off your brand name or key message. Lead with the most important keyword — don\'t bury it at the end.',
    };
  }

  return {
    name: '[Content] Title Tag',
    status: 'pass',
    message: `Title tag found (${title.length} chars).`,
    details: title,
  };
}

module.exports = titleTagAudit;
