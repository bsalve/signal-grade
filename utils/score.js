'use strict';

const GRADE_LABELS = {
  A: 'Excellent — this site is well-optimised for local SEO.',
  B: 'Good — a few improvements would push this site to the top tier.',
  C: 'Average — several important local SEO signals are missing or weak.',
  D: 'Poor — significant issues are likely hurting local search visibility.',
  F: 'Critical — foundational local SEO elements are missing.',
};

function normalizeScore(result) {
  if (result.score !== undefined)
    return Math.round((result.score / (result.maxScore ?? 100)) * 100);
  if (result.status === 'pass') return 100;
  if (result.status === 'warn') return 50;
  return 0;
}

function calcTotalScore(results) {
  if (!results.length) return 0;
  return Math.round(results.reduce((sum, r) => sum + normalizeScore(r), 0) / results.length);
}

function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function gradeSummary(grade, score) {
  return `${grade} (${score}/100) — ${GRADE_LABELS[grade]}`;
}

function buildJsonOutput(url, results, score, grade) {
  return {
    url,
    auditedAt: new Date().toISOString(),
    grade,
    totalScore: score,
    summary: gradeSummary(grade, score),
    results: results.map((r) => ({
      name:            r.name,
      status:          r.status,
      score:           r.score,
      maxScore:        r.maxScore,
      normalizedScore: normalizeScore(r),
      message:         r.message,
      details:         r.details,
      recommendation:  r.recommendation,
    })),
  };
}

module.exports = { normalizeScore, calcTotalScore, letterGrade, gradeSummary, buildJsonOutput };
