const https = require('https');
const tls = require('tls');

const AUDIT_NAME = 'SSL / HTTPS';

function getDaysUntilExpiry(cert) {
  const expiry = new Date(cert.valid_to);
  const now = new Date();
  return Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
}

function checkSSL($, html, url) {
  return new Promise((resolve) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return resolve({
        name: AUDIT_NAME,
        status: 'fail',
        score: 0,
        message: 'Invalid URL provided.',
        recommendation: 'Ensure the URL is correctly formatted, e.g. https://example.com.',
      });
    }

    if (parsedUrl.protocol !== 'https:') {
      return resolve({
        name: AUDIT_NAME,
        status: 'fail',
        score: 0,
        message: 'Site is not served over HTTPS.',
        recommendation:
          'Install an SSL certificate and redirect all HTTP traffic to HTTPS. ' +
          'Free certificates are available via Let\'s Encrypt. HTTPS is a confirmed ' +
          'Google ranking signal and protects user data.',
      });
    }

    const options = {
      host: parsedUrl.hostname,
      port: 443,
      servername: parsedUrl.hostname,
      rejectUnauthorized: false, // we validate manually below
    };

    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();

      if (!cert || !cert.subject) {
        return resolve({
          name: AUDIT_NAME,
          status: 'fail',
          score: 0,
          message: 'No SSL certificate returned by the server.',
          recommendation:
            'Ensure a valid SSL certificate is installed and the server is configured ' +
            'to present it on port 443.',
        });
      }

      if (!socket.authorized) {
        return resolve({
          name: AUDIT_NAME,
          status: 'fail',
          score: 20,
          message: `SSL certificate is invalid or untrusted: ${socket.authorizationError}`,
          recommendation:
            'Replace the current certificate with one issued by a trusted Certificate Authority (CA). ' +
            'Self-signed or expired certificates cause browser warnings that drive users away and ' +
            'signal poor site quality to search engines.',
        });
      }

      const daysLeft = getDaysUntilExpiry(cert);

      if (daysLeft < 0) {
        return resolve({
          name: AUDIT_NAME,
          status: 'fail',
          score: 10,
          message: `SSL certificate expired ${Math.abs(daysLeft)} day(s) ago.`,
          recommendation:
            'Renew your SSL certificate immediately. An expired certificate causes browser ' +
            'security warnings and will prevent users from reaching your site.',
        });
      }

      if (daysLeft <= 30) {
        return resolve({
          name: AUDIT_NAME,
          status: 'warn',
          score: 70,
          message: `SSL certificate expires in ${daysLeft} day(s).`,
          recommendation:
            'Renew your SSL certificate before it expires to avoid downtime and browser warnings. ' +
            'Consider enabling auto-renewal through your hosting provider or Let\'s Encrypt.',
        });
      }

      resolve({
        name: AUDIT_NAME,
        status: 'pass',
        score: 100,
        message: `HTTPS is active. Certificate is valid for ${daysLeft} more day(s).`,
        details: `Issued to: ${cert.subject.CN} | Expires: ${cert.valid_to}`,
      });
    });

    socket.on('error', (err) => {
      resolve({
        name: AUDIT_NAME,
        status: 'fail',
        score: 0,
        message: `Could not establish SSL connection: ${err.message}`,
        recommendation:
          'Verify that port 443 is open on your server, a certificate is installed, ' +
          'and your DNS is resolving correctly.',
      });
    });
  });
}

module.exports = checkSSL;
