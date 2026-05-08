'use strict';
const db = require('./db');

const TOKEN_REFRESH_URL = 'https://oauth2.googleapis.com/token';
const GA4_ADMIN_URL     = 'https://analyticsadmin.googleapis.com/v1alpha/accountSummaries';
const GA4_DATA_URL      = 'https://analyticsdata.googleapis.com/v1beta/properties';

async function getValidToken(userId) {
  if (!db) return null;
  const user = await db('users').where({ id: userId }).first();
  if (!user || !user.google_access_token) return null;

  const expiry  = Number(user.google_token_expiry);
  const bufferMs = 60 * 1000;

  if (Date.now() < expiry - bufferMs) {
    return user.google_access_token;
  }

  if (!user.google_refresh_token) return null;

  try {
    const res = await fetch(TOKEN_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID     || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: user.google_refresh_token,
        grant_type:    'refresh_token',
      }).toString(),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;

    const newExpiry = Date.now() + ((data.expires_in ?? 3600) * 1000);
    await db('users').where({ id: userId }).update({
      google_access_token: data.access_token,
      google_token_expiry: newExpiry,
    });

    return data.access_token;
  } catch {
    return null;
  }
}

async function getGa4Data(userId, siteUrl) {
  const token = await getValidToken(userId);
  if (!token) return { connected: false };

  let host;
  try {
    host = new URL(siteUrl).hostname.replace(/^www\./, '');
  } catch {
    return { connected: false };
  }

  // Fetch GA4 account + property summaries
  let accountSummaries;
  try {
    const res = await fetch(GA4_ADMIN_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    accountSummaries = data.accountSummaries || [];
  } catch {
    return { connected: false };
  }

  // Find a GA4 property whose web data stream hostname matches siteUrl
  let propertyId = null;
  outer: for (const account of accountSummaries) {
    for (const prop of (account.propertySummaries || [])) {
      const propName = prop.property || '';  // e.g. "properties/123456789"
      // Match by display name or check data streams
      // We check web streams via a separate call only if needed
      // Simple heuristic: try to match by property display name containing the host
      const displayName = (prop.displayName || '').toLowerCase();
      if (displayName.includes(host) || displayName.includes(host.replace(/\./g, ''))) {
        propertyId = propName.replace('properties/', '');
        break outer;
      }
    }
  }

  // If no match by name, try fetching web data streams for each property
  if (!propertyId) {
    for (const account of accountSummaries) {
      for (const prop of (account.propertySummaries || [])) {
        const propName = prop.property || '';
        const pid = propName.replace('properties/', '');
        if (!pid) continue;
        try {
          const streamsRes = await fetch(`https://analyticsadmin.googleapis.com/v1alpha/${propName}/dataStreams`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(6000),
          });
          if (!streamsRes.ok) continue;
          const streamsData = await streamsRes.json();
          const streams = streamsData.dataStreams || [];
          const match = streams.find(s => {
            const uri = (s.webStreamData?.defaultUri || '').replace(/^www\./, '').replace(/^https?:\/\//, '').replace(/\/.*/, '');
            return uri === host;
          });
          if (match) {
            propertyId = pid;
            break;
          }
        } catch {
          continue;
        }
      }
      if (propertyId) break;
    }
  }

  if (!propertyId) return { connected: false };

  // Fetch GA4 report: last 28 days, by channel group
  const endDate   = new Date();
  const startDate = new Date(endDate - 28 * 24 * 60 * 60 * 1000);
  const fmt       = d => d.toISOString().slice(0, 10);

  let rows;
  try {
    const res = await fetch(`${GA4_DATA_URL}/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges:  [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        dimensions:  [{ name: 'sessionDefaultChannelGroup' }],
        metrics:     [{ name: 'sessions' }, { name: 'engagementRate' }],
        orderBys:    [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { connected: true, propertyId, rows: [] };
    const data = await res.json();
    rows = (data.rows || []).map(r => ({
      channel:       (r.dimensionValues?.[0]?.value) || '',
      sessions:      parseInt(r.metricValues?.[0]?.value || '0', 10),
      engagementRate: parseFloat(r.metricValues?.[1]?.value || '0'),
    }));
  } catch {
    return { connected: true, propertyId, rows: [] };
  }

  return { connected: true, propertyId, rows };
}

module.exports = { getGa4Data };
