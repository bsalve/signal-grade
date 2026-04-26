const AUDIT_NAME = '[Technical] Web App Manifest';

module.exports = function checkWebManifest($, html, url) {
  const manifestLink = $('link[rel="manifest"]');
  const hasManifest  = manifestLink.length > 0;
  const manifestHref = hasManifest ? manifestLink.first().attr('href') || '' : '';

  const appleTouchIcon = $('link[rel="apple-touch-icon"]').length > 0;

  if (hasManifest) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Web App Manifest found.',
      details: manifestHref ? `Manifest: ${manifestHref}` : undefined,
    };
  }

  if (appleTouchIcon) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 60,
      message: 'No Web App Manifest found, but apple-touch-icon is present.',
      recommendation:
        'Add a manifest.json file and link it with <link rel="manifest" href="/manifest.json">. ' +
        'A web app manifest enables PWA features like "Add to Home Screen", ' +
        'improves brand consistency across platforms, and is a positive signal for mobile-first indexing.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'fail',
    score: 0,
    message: 'No Web App Manifest or apple-touch-icon found.',
    recommendation:
      'Create a manifest.json defining your app name, icons, and theme color, ' +
      'then add <link rel="manifest" href="/manifest.json"> in <head>. ' +
      'Also add <link rel="apple-touch-icon" href="/apple-touch-icon.png"> for iOS home screen support. ' +
      'These signals improve mobile usability and are evaluated by Google\'s mobile-first indexing.',
  };
};
