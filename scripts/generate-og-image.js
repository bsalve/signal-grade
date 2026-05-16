'use strict';
/**
 * Generates public/og-image.png — the 1200×630 social preview card.
 * Run once: node scripts/generate-og-image.js
 * Requires puppeteer (already a project dependency).
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1200px; height: 630px; overflow: hidden; background: #0b0c0e; }
body {
  font-family: 'Inter', sans-serif;
  color: #e4e6ea;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 64px 80px;
  position: relative;
}

/* Background grid */
body::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(77,159,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(77,159,255,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
}
/* Radial glow */
body::after {
  content: '';
  position: absolute;
  top: -120px;
  left: -120px;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(77,159,255,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.left {
  position: relative;
  z-index: 1;
  max-width: 600px;
}

.wordmark {
  font-family: 'Space Mono', monospace;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #4d9fff;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.wordmark-dot { width: 6px; height: 6px; background: #4d9fff; border-radius: 50%; }

.headline {
  font-family: 'Inter', sans-serif;
  font-size: 44px;
  font-weight: 600;
  line-height: 1.15;
  color: #e4e6ea;
  margin-bottom: 20px;
}
.headline span { color: #4d9fff; }

.tagline {
  font-size: 17px;
  color: #8892a4;
  line-height: 1.5;
  max-width: 460px;
}

.right {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.grade-card {
  width: 180px;
  height: 180px;
  background: #111214;
  border: 1px solid #1e2025;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.grade-letter {
  font-family: 'Space Mono', monospace;
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  color: #34d399;
}
.grade-score {
  font-family: 'Space Mono', monospace;
  font-size: 14px;
  color: #8892a4;
}

.pillars {
  display: flex;
  gap: 8px;
}
.pillar {
  width: 40px;
  height: 56px;
  border-radius: 6px;
  border: 1px solid #1e2025;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 6px;
  background: #111214;
  overflow: hidden;
  position: relative;
}
.pillar-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 4px 4px 0 0;
}
.pillar-label {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  position: relative;
  z-index: 1;
  color: #e4e6ea;
}
</style>
</head>
<body>
  <div class="left">
    <div class="wordmark">
      <div class="wordmark-dot"></div>
      SearchGrade
    </div>
    <div class="headline">Score your site across<br /><span>Google, and across AI.</span></div>
    <div class="tagline">100+ checks across Technical SEO, Content, AEO, and GEO. Instant graded audit with a PDF report.</div>
  </div>
  <div class="right">
    <div class="grade-card">
      <div class="grade-letter">A</div>
      <div class="grade-score">92 / 100</div>
    </div>
    <div class="pillars">
      <div class="pillar">
        <div class="pillar-fill" style="height:80%;background:rgba(136,146,164,0.25)"></div>
        <div class="pillar-label" style="color:#8892a4">Tech</div>
      </div>
      <div class="pillar">
        <div class="pillar-fill" style="height:90%;background:rgba(232,168,124,0.25)"></div>
        <div class="pillar-label" style="color:#e8a87c">Cont</div>
      </div>
      <div class="pillar">
        <div class="pillar-fill" style="height:70%;background:rgba(123,174,255,0.25)"></div>
        <div class="pillar-label" style="color:#7baeff">AEO</div>
      </div>
      <div class="pillar">
        <div class="pillar-fill" style="height:85%;background:rgba(176,123,255,0.25)"></div>
        <div class="pillar-label" style="color:#b07bff">GEO</div>
      </div>
    </div>
  </div>
</body>
</html>`;

(async () => {
  const outPath = path.join(__dirname, '..', 'public', 'og-image.png');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(HTML, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: outPath, type: 'png' });
    console.log('Generated:', outPath);
  } finally {
    await browser.close();
  }
})();
