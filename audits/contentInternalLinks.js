function contentInternalLinks($, html, url) {
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch (_) {}

  const internalHrefs = [];

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (href.startsWith('#')) return; // anchor-only links

    // Relative paths and same-domain absolute URLs count as internal
    if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
      internalHrefs.push(href);
    } else if (hostname) {
      try {
        const linked = new URL(href);
        if (linked.hostname === hostname || linked.hostname.endsWith('.' + hostname)) {
          internalHrefs.push(linked.pathname);
        }
      } catch (_) {
        // unparseable href — skip
      }
    }
  });

  const count = internalHrefs.length;
  const sample = [...new Set(internalHrefs)].slice(0, 5);

  if (count === 0) {
    return {
      name: '[Technical] Internal Links',
      status: 'fail',
      score: 0,
      message: 'No internal links found on this page.',
      recommendation:
        'Add links to other pages on your site. Internal links help search engine crawlers ' +
        'discover all your pages and distribute ranking signals across your site. ' +
        'Isolated pages (no inbound or outbound internal links) are harder to rank.',
    };
  }

  if (count <= 2) {
    return {
      name: '[Technical] Internal Links',
      status: 'warn',
      score: 50,
      message: `Only ${count} internal link(s) found — consider adding more.`,
      details: `Links to: ${sample.join(', ')}`,
      recommendation:
        'Add more internal links to related pages, services, or blog posts. A well-linked site ' +
        'helps crawlers index all content and passes authority between pages.',
    };
  }

  const score = count >= 10 ? 100 : 80;

  return {
    name: '[Technical] Internal Links',
    status: 'pass',
    score,
    message: `${count} internal link(s) found.`,
    details: `Sample: ${sample.join(', ')}${count > 5 ? ` (+${count - 5} more)` : ''}`,
  };
}

module.exports = contentInternalLinks;
