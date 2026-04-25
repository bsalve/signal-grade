'use strict';

// Tier definitions — update limits here when changing plan features.
const TIERS = {
  free: {
    name:              'Free',
    crawlPageLimit:    10,   // max pages in site audit
    multiAuditLimit:   3,    // max URLs in multi/compare audit
    rateLimit: {
      windowMs:        60 * 60 * 1000, // 1 hour
      max:             10,
    },
  },
  pro: {
    name:              'Pro',
    crawlPageLimit:    50,
    multiAuditLimit:   10,
    rateLimit: {
      windowMs:        60 * 60 * 1000,
      max:             60,
    },
  },
  agency: {
    name:              'Agency',
    crawlPageLimit:    200,
    multiAuditLimit:   10,
    rateLimit: {
      windowMs:        60 * 60 * 1000,
      max:             200,
    },
  },
};

// Anonymous (not signed in) users get a tighter limit than even free accounts.
const ANON_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      5,
};

/**
 * Return the tier config for a given user object (or null for anonymous).
 * Falls back to 'free' if the plan value is unrecognized.
 */
function getTier(user) {
  if (!user) return null; // anonymous — caller uses ANON_RATE_LIMIT
  const plan = user.plan || 'free';
  return TIERS[plan] || TIERS.free;
}

/**
 * Express middleware factory: attach tier info to req so downstream
 * handlers can make gating decisions without re-fetching the user.
 *
 *   req.tier  — the TIERS entry for this user (or null if anonymous)
 *   req.plan  — string: 'free' | 'pro' | 'agency' | 'anon'
 */
function attachTier(req, res, next) {
  req.tier = getTier(req.user || null);
  req.plan = req.user ? (req.user.plan || 'free') : 'anon';
  next();
}

module.exports = { TIERS, ANON_RATE_LIMIT, getTier, attachTier };
