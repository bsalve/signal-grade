/* ── AI cache ── */
  let _currentReportId = null;
  let _aiRecsCache = {};  // checkName → recommendation text

/* ── Mode toggle ── */
  let currentMode = 'page';
  function setMode(mode) {
    currentMode = mode;
    document.getElementById('modePageBtn').classList.toggle('active', mode === 'page');
    document.getElementById('modeSiteBtn').classList.toggle('active', mode === 'site');
    document.getElementById('modeMultiBtn').classList.toggle('active', mode === 'multi');
    const bulkBtn = document.getElementById('modeBulkBtn');
    if (bulkBtn) bulkBtn.classList.toggle('active', mode === 'bulk');
    document.getElementById('crawlLimitNote').style.display  = mode === 'site'  ? 'block' : 'none';
    document.getElementById('singleInputWrap').style.display = (mode === 'page' || mode === 'site') ? 'block' : 'none';
    document.getElementById('multiInputWrap').style.display  = mode === 'multi' ? 'block' : 'none';
    const bulkWrap = document.getElementById('bulkInputWrap');
    if (bulkWrap) bulkWrap.style.display = mode === 'bulk' ? 'block' : 'none';
    document.getElementById('customizeRow').style.display    = (mode === 'page' || mode === 'site') ? 'block' : 'none';
  }

  /* ── Customize panel ── */
  function toggleCustomize() {
    const panel = document.getElementById('customizePanel');
    const btn   = document.querySelector('.customize-toggle');
    const open  = panel.style.display === 'block';
    panel.style.display = open ? 'none' : 'block';
    btn.textContent     = open ? '+ Customize Report' : '− Customize Report';
  }

  /* ── Step cycling ── */
  const STEPS = [
    'Resolving domain',
    'Fetching page HTML',
    '[Technical] Checking SSL certificate',
    '[Technical] Scanning robots.txt & sitemap',
    '[Technical] Checking canonical URL',
    '[Technical] Checking meta robots',
    '[Technical] Checking internal links',
    '[Technical] Analyzing structured data',
    '[Technical] Checking business hours schema',
    '[Technical] Checking aggregate rating schema',
    '[Technical] Checking geo coordinates',
    '[Technical] Querying PageSpeed Insights',
    '[Technical] Checking mobile friendliness',
    '[Technical] Checking Core Web Vitals',
    '[Technical] Checking hreflang / i18n tags',
    '[Technical] Checking for broken internal links',
    '[Technical] Checking for redirect chains',
    '[Technical] Checking for mixed content',
    '[Technical] Checking security headers',
    '[Technical] Checking compression',
    '[Technical] Checking favicon',
    '[Technical] Checking image dimensions',
    '[Technical] Checking breadcrumb schema',
    '[Technical] Measuring response time',
    '[Technical] Checking mobile viewport tag',
    '[Technical] Checking page indexability',
    '[Technical] Inventorying structured data types',
    '[Technical] Validating schema required fields',
    '[Technical] Checking image lazy loading',
    '[Technical] Detecting HTTP version',
    '[Technical] Checking robots.txt safety',
    '[Technical] Checking canonical chain',
    '[Technical] Validating sitemap URLs',
    '[Technical] Checking accessibility signals',
    '[Technical] Checking pagination tags',
    '[Technical] Checking Cache-Control header',
    '[Technical] Checking Content Security Policy',
    '[Technical] Checking resource hints (preconnect)',
    '[Technical] Checking render-blocking scripts',
    '[Technical] Checking asset minification',
    '[Technical] Checking web app manifest',
    '[Technical] Checking robots.txt crawl delay',
    '[Technical] Checking X-Robots-Tag header',
    '[Technical] Checking AMP page',
    '[Technical] Checking Interaction to Next Paint',
    '[Technical] Auditing third-party scripts',
    '[Technical] Checking JavaScript bundle size',
    '[Technical] Checking cookie consent',
    '[Technical] Analyzing URL structure',
    '[Technical] Checking DNS TTL',
    '[Content] Auditing meta tags',
    '[Content] Checking title tag',
    '[Content] Checking meta description',
    '[Content] Checking H1 headings',
    '[Content] Checking heading hierarchy',
    '[Content] Analyzing content length',
    '[Content] Checking image alt text',
    '[Content] Auditing Open Graph & social tags',
    '[Content] Checking brand consistency',
    '[Content] Checking NAP consistency',
    '[Content] Checking social media links',
    '[Content] Checking readability score',
    '[Content] Checking content freshness',
    '[Content] Checking outbound links',
    '[Content] Checking calls to action',
    '[Content] Checking image optimization',
    '[Content] Checking og:image reachability',
    '[Content] Analyzing keyword frequency',
    '[Content] Measuring E-E-A-T composite score',
    '[Content] Checking content-to-code ratio',
    '[Content] Analyzing passive voice and tone',
    '[Content] Checking spelling and grammar',
    '[AEO] Checking FAQ & question schema',
    '[AEO] Checking speakable markup',
    '[AEO] Analyzing question-based headings',
    '[AEO] Checking video schema',
    '[AEO] Checking how-to schema',
    '[AEO] Checking featured snippet format',
    '[AEO] Checking article schema',
    '[AEO] Checking definition content',
    '[AEO] Checking concise answer paragraphs',
    '[AEO] Checking table content for AI citation',
    '[AEO] Checking answer-first structure',
    '[AEO] Detecting comparison content',
    '[AEO] Measuring Q&A heading density',
    '[GEO] Auditing E-E-A-T signals',
    '[GEO] Checking organization entity clarity',
    '[GEO] Analyzing structured content',
    '[GEO] Checking privacy & trust signals',
    '[GEO] Checking Google Business Profile link',
    '[GEO] Checking source citations',
    '[GEO] Checking service / product schema',
    '[GEO] Checking author schema',
    '[GEO] Checking review content',
    '[GEO] Checking service area content',
    '[GEO] Checking multi-modal content',
    '[GEO] Checking llms.txt',
    '[GEO] Checking AI crawler access',
    '[GEO] Checking AI search presence',
    '[GEO] Analyzing semantic HTML structure',
    '[GEO] Checking knowledge graph entity depth',
    '[GEO] Auditing sameAs link authority',
    '[GEO] Measuring fact density',
    '[GEO] Checking brand disambiguation',
    '[GEO] Checking AI citation signals',
    'Calculating score',
    'Generating PDF report',
  ];
  const _cc = document.getElementById('checkCount');
  if (_cc) _cc.textContent = STEPS.filter(s => s.startsWith('[')).length;

  let stepInterval = null, currentStep = 0;

  function updateProgress() {
    const pct = Math.round((currentStep / STEPS.length) * 100);
    document.getElementById('progressFill').style.width = pct + '%';
    const label = STEPS[Math.min(currentStep, STEPS.length - 1)];
    document.getElementById('statusText').textContent = label + '...';
  }

  function showProgressUI() {
    document.getElementById('statusLine').style.display = 'flex';
    document.getElementById('progressTrack').style.display = 'block';
    document.getElementById('progressFill').style.width = '0%';
  }

  function startSteps() {
    currentStep = 0;
    showProgressUI();
    updateProgress();
    stepInterval = setInterval(() => {
      if (currentStep < STEPS.length - 1) {
        currentStep++;
        updateProgress();
      }
    }, Math.max(500, Math.round(20000 / STEPS.length)));
  }

  function stopSteps() {
    clearInterval(stepInterval);
    document.getElementById('statusLine').style.display = 'none';
    document.getElementById('progressTrack').style.display = 'none';
  }

  /* ── Animated score counter ── */
  function countUp(el, target, duration = 1200) {
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 4); // ease-out-quart
      el.textContent = Math.round(ease * target);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ── Color helpers ── */
  function letterGrade(n) {
    return n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 70 ? 'C' : n >= 60 ? 'D' : 'F';
  }

  function gradeColor(score) {
    if (score >= 90) return 'var(--pass)';
    if (score >= 80) return '#00ccff';
    if (score >= 70) return 'var(--warn)';
    if (score >= 60) return '#ff8800';
    return 'var(--fail)';
  }

  function statusIcon(s) { return s === 'pass' ? '✓' : s === 'warn' ? '△' : '✕'; }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Blob download helper ── */
  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Strip [Category] prefix from audit check names ── */
  function stripAuditPrefix(name) {
    return name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, '');
  }

  /* ── Per-category average score (normalizedScore-based) ── */
  function calcCatAvg(resultsArr, prefix) {
    const items = resultsArr.filter(r => r.name.startsWith(prefix));
    if (!items.length) return 0;
    return Math.round(items.reduce((s, r) => s + (r.normalizedScore ?? 0), 0) / items.length);
  }

  /* ── Audit export (page + site, JSON + CSV) ── */
  function exportAudit(source, format) {
    if (source === 'page') {
      if (!window._lastAuditData) return;
      if (format === 'json') {
        downloadBlob(JSON.stringify(window._lastAuditData, null, 2), 'searchgrade-report.json', 'application/json');
      } else {
        const rows = (window._lastAuditData.results || []).map(r =>
          [r.name, r.status, r.normalizedScore !== null && r.normalizedScore !== undefined ? r.normalizedScore : '', r.message || '', r.recommendation || '']
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
        );
        downloadBlob(['name,status,score,message,recommendation', ...rows].join('\n'), 'searchgrade-report.csv', 'text/csv');
      }
    } else {
      if (!_latestSiteResults.length) return;
      if (format === 'json') {
        downloadBlob(JSON.stringify({ url: _latestSiteUrl, results: _latestSiteResults }, null, 2), 'searchgrade-site-report.json', 'application/json');
      } else {
        const rows = _latestSiteResults.map(r =>
          [r.name, r.fail.length > 0 ? 'fail' : r.warn.length > 0 ? 'warn' : 'pass',
           r.fail.length, r.warn.length, r.pass.length, r.recommendation || '']
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
        );
        downloadBlob(['name,status,failCount,warnCount,passCount,recommendation', ...rows].join('\n'), 'searchgrade-site-report.csv', 'text/csv');
      }
    }
  }
  function exportPageJSON() { exportAudit('page', 'json'); }
  function exportPageCSV()  { exportAudit('page', 'csv'); }
  function exportSiteJSON() { exportAudit('site', 'json'); }
  function exportSiteCSV()  { exportAudit('site', 'csv'); }

  /* ── XLSX export for crawl results ── */
  async function exportCrawlXLSX() {
    const data = window._lastSiteData;
    if (!data) return;
    // Lazy-load SheetJS
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const XLSX = window.XLSX;

    // Sheet 1: Pages summary
    // Site results shape: { name (check), pass: [url,...], warn: [url,...], fail: [url,...] }
    // We pivot to get per-page view
    const pageMap = {};
    for (const ck of (data.results || [])) {
      for (const u of (ck.pass || [])) { if (!pageMap[u]) pageMap[u] = {pass:0,warn:0,fail:0}; pageMap[u].pass++; }
      for (const u of (ck.warn || [])) { if (!pageMap[u]) pageMap[u] = {pass:0,warn:0,fail:0}; pageMap[u].warn++; }
      for (const u of (ck.fail || [])) { if (!pageMap[u]) pageMap[u] = {pass:0,warn:0,fail:0}; pageMap[u].fail++; }
    }
    const pagesData = [['URL', 'Pass', 'Warn', 'Fail']];
    for (const [u, counts] of Object.entries(pageMap)) {
      pagesData.push([u, counts.pass, counts.warn, counts.fail]);
    }

    // Sheet 2: Issues (checks with at least one fail or warn)
    const issuesData = [['Check', 'Status', 'Fail Count', 'Warn Count', 'Sample URLs']];
    for (const ck of (data.results || [])) {
      if ((ck.fail || []).length > 0 || (ck.warn || []).length > 0) {
        const status = (ck.fail || []).length > 0 ? 'fail' : 'warn';
        const sample = [...(ck.fail || []), ...(ck.warn || [])].slice(0, 3).join(', ');
        issuesData.push([ck.name || '', status, (ck.fail||[]).length, (ck.warn||[]).length, sample]);
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pagesData),  'Pages');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(issuesData), 'Issues');

    const domain = data.siteUrl ? (() => { try { return new URL(data.siteUrl).hostname.replace(/^www\./, ''); } catch { return 'site'; } })() : 'site';
    XLSX.writeFile(wb, `searchgrade-crawl-${domain}.xlsx`);
  }

  /* ── Domain display helper ── */
  function toDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url; }
  }

  /* ── Bulk audit ── */
  let _latestBulkResults = [];

  async function runBulkAudit() {
    const textarea = document.getElementById('bulkUrlInput');
    if (!textarea) return;
    const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { showError('Enter at least one URL.'); return; }

    clearError();
    const btn = document.getElementById('bulkAuditBtn');
    if (btn) btn.disabled = true;
    const results = document.getElementById('results');
    results.style.display = 'none';
    results.classList.remove('visible');
    showProgressUI();
    document.getElementById('statusText').textContent = `Running bulk audit on ${lines.length} URL${lines.length !== 1 ? 's' : ''}...`;
    document.getElementById('progressFill').style.width = '10%';

    try {
      const res = await fetch('/bulk-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: lines }),
      });
      const data = await res.json();
      document.getElementById('progressFill').style.width = '100%';
      document.getElementById('statusText').textContent = 'Done.';
      await new Promise(r => setTimeout(r, 600));
      document.getElementById('statusLine').style.display = 'none';
      document.getElementById('progressTrack').style.display = 'none';

      if (!res.ok) { showError(data.message || 'Bulk audit failed.'); if (btn) btn.disabled = false; return; }

      _latestBulkResults = data.results || [];
      renderBulkResults(_latestBulkResults);
      results.style.display = 'block';
      requestAnimationFrame(() => {
        results.scrollIntoView({ behavior: 'smooth' });
        requestAnimationFrame(() => results.classList.add('visible'));
      });
    } catch {
      document.getElementById('statusLine').style.display = 'none';
      document.getElementById('progressTrack').style.display = 'none';
      showError('Could not connect to the server.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderBulkResults(results) {
    // Aggregate stats across all URLs
    const validResults = results.filter(r => !r.error && r.score != null);
    const avgScore = validResults.length ? Math.round(validResults.reduce((s, r) => s + r.score, 0) / validResults.length) : 0;
    const avgGrade = letterGrade(avgScore);
    const avgColor = gradeColor(avgScore);
    const totalFail = validResults.reduce((s, r) => s + (r.failCount || 0), 0);
    const totalWarn = validResults.reduce((s, r) => s + (r.warnCount || 0), 0);
    const totalPass = validResults.reduce((s, r) => s + (r.passCount || 0), 0);

    const rows = results.map(r => {
      if (r.error) {
        return `<tr>
          <td style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text);padding:10px 12px;border-bottom:1px solid var(--border);max-width:300px;word-break:break-all">${esc(r.url)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid var(--border);color:var(--muted);font-size:12px" colspan="4">${esc(r.error)}</td>
        </tr>`;
      }
      const gColor = gradeColor(r.score);
      const issues = r.topIssues.map(i => `<span style="font-size:10px;color:var(--fail);margin-right:6px">${esc(i)}</span>`).join('');
      return `<tr>
        <td style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text);padding:10px 12px;border-bottom:1px solid var(--border);max-width:300px;word-break:break-all">${esc(r.url)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border);text-align:center;font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${gColor}">${r.grade}</td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border);text-align:center;font-family:'Space Mono',monospace;color:${gColor}">${r.score}</td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border);text-align:center;font-size:12px"><span style="color:var(--fail)">${r.failCount}✕</span> <span style="color:var(--warn)">${r.warnCount}△</span> <span style="color:var(--pass)">${r.passCount}✓</span></td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border)">${issues || '<span style="font-size:11px;color:var(--muted)">—</span>'}</td>
      </tr>`;
    }).join('');

    const csv = [['URL','Grade','Score','Fails','Warns','Passes','Top Issues'],
      ...results.map(r => [r.url, r.grade || '', r.score ?? '', r.failCount, r.warnCount, r.passCount, (r.topIssues || []).join('; ')])
        .map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    ].join('\n');

    document.getElementById('resultsInner').innerHTML = `
      <div class="site-results-wrap">
        <div class="site-results-header">
          <strong>${results.length} URL${results.length !== 1 ? 's' : ''} audited</strong>
        </div>

        <div class="site-grade-block" id="bulkGradeBlock">
          <div class="site-grade-letter" style="color:${avgColor}">${avgGrade}</div>
          <div class="site-grade-score" style="color:${avgColor}">${avgScore}/100</div>
          <div class="site-grade-label">Avg Score · ${results.length} URLs</div>
        </div>

        <div class="site-summary-stats" id="bulkStats">
          <div class="site-stat-cell site-stat-fail">
            <div class="site-stat-n">${totalFail}</div>
            <div class="site-stat-l">total fails</div>
          </div>
          <div class="site-stat-cell site-stat-warn">
            <div class="site-stat-n">${totalWarn}</div>
            <div class="site-stat-l">total warnings</div>
          </div>
          <div class="site-stat-cell site-stat-pass">
            <div class="site-stat-n">${totalPass}</div>
            <div class="site-stat-l">total passes</div>
          </div>
        </div>

        <div id="bulkExports" style="display:flex;gap:12px;justify-content:center;margin-bottom:28px">
          <button class="pdf-link" style="background:none;cursor:pointer" onclick="(function(){
            const csv = ${JSON.stringify(csv)};
            const blob = new Blob([csv],{type:'text/csv'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download='searchgrade-bulk.csv'; a.click();
          })()">
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Export CSV
          </button>
        </div>

        <div class="bulk-table-wrap" id="bulkTable" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:600px">
            <thead>
              <tr style="border-bottom:2px solid var(--border)">
                <th style="padding:8px 12px;text-align:left;font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase">URL</th>
                <th style="padding:8px 12px;text-align:center;font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase">Grade</th>
                <th style="padding:8px 12px;text-align:center;font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase">Score</th>
                <th style="padding:8px 12px;text-align:center;font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase">Checks</th>
                <th style="padding:8px 12px;text-align:left;font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase">Top Issues</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;

    /* Trigger bulk animations */
    requestAnimationFrame(() => {
      setTimeout(() => { document.getElementById('bulkGradeBlock')?.classList.add('in'); }, 100);
      setTimeout(() => { document.getElementById('bulkStats')?.classList.add('in'); }, 250);
      setTimeout(() => { document.getElementById('bulkExports')?.querySelectorAll('.pdf-link').forEach(el => el.classList.add('in')); }, 400);
      setTimeout(() => { document.getElementById('bulkTable')?.classList.add('in'); }, 550);
    });
  }

  /* ── AI Fix Recommendations ── */
  function _showAiRec(btnEl, recommendation) {
    const container = btnEl.closest('.row-inner');
    let suggestEl = container?.querySelector('.ai-fix-suggestion');
    if (!suggestEl) {
      suggestEl = document.createElement('div');
      suggestEl.className = 'meta-suggestion ai-fix-suggestion';
      btnEl.insertAdjacentElement('afterend', suggestEl);
    }
    suggestEl.innerHTML = `<span class="meta-suggestion-text">${esc(recommendation)}</span> <button class="rec-btn" data-copy="${esc(recommendation)}" onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500)})">Copy</button>`;
    btnEl.textContent = 'Regenerate →';
    btnEl.disabled = false;
  }

  async function aiFixRec(url, checkName, message, details, btnEl) {
    const forceRegenerate = btnEl.textContent.trim() === 'Regenerate →';

    // Serve from in-memory cache if available and not regenerating
    if (!forceRegenerate && _aiRecsCache[checkName]) {
      _showAiRec(btnEl, _aiRecsCache[checkName]);
      return;
    }

    btnEl.disabled = true;
    btnEl.textContent = 'Generating...';
    try {
      const res = await fetch('/api/ai-fix-rec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, checkName, message, details, reportId: _currentReportId, forceRegenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        btnEl.textContent = data.message || 'Error';
        setTimeout(() => { btnEl.textContent = forceRegenerate ? 'Regenerate →' : 'AI Fix →'; btnEl.disabled = false; }, 3000);
        return;
      }
      _aiRecsCache[checkName] = data.recommendation;
      _showAiRec(btnEl, data.recommendation);
    } catch {
      btnEl.textContent = 'Error — try again';
      setTimeout(() => { btnEl.textContent = forceRegenerate ? 'Regenerate →' : 'AI Fix →'; btnEl.disabled = false; }, 3000);
    }
  }

  /* ── AI Meta Generator ── */
  async function generateMeta(url, type, btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = 'Generating...';
    try {
      const res = await fetch('/api/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        btnEl.textContent = data.message || 'Error';
        setTimeout(() => { btnEl.textContent = 'Generate →'; btnEl.disabled = false; }, 3000);
        return;
      }
      // Find the result row and inject the suggestion
      const container = btnEl.closest('.row-inner');
      let suggestEl = container?.querySelector('.meta-suggestion');
      if (!suggestEl) {
        suggestEl = document.createElement('div');
        suggestEl.className = 'meta-suggestion';
        btnEl.insertAdjacentElement('afterend', suggestEl);
      }
      suggestEl.innerHTML = `<span class="meta-suggestion-text">${esc(data.generated)}</span> <button class="rec-btn" data-copy="${esc(data.generated)}" onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500)})">Copy</button>`;
      btnEl.textContent = 'Regenerate →';
      btnEl.disabled = false;
    } catch {
      btnEl.textContent = 'Error — try again';
      setTimeout(() => { btnEl.textContent = 'Generate →'; btnEl.disabled = false; }, 3000);
    }
  }

  /* ── Main audit fn ── */
  async function runAudit() {
    if (currentMode === 'multi') { runMultiAudit(); return; }
    if (currentMode === 'bulk') { runBulkAudit(); return; }
    const url = document.getElementById('urlInput').value.trim();
    if (!url) { showError('Enter a URL first.'); return; }
    if (currentMode === 'site') { runSiteAudit(url); return; }

    clearError();
    document.getElementById('auditBtn').disabled = true;
    const results = document.getElementById('results');
    results.style.display = 'none';
    results.classList.remove('visible');
    startSteps();

    try {
      const logoUrl  = document.getElementById('logoUrlInput').value.trim();
      const jsRender = document.getElementById('jsRenderToggle')?.checked || false;
      const res  = await fetch('/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...(logoUrl && { logoUrl }), ...(jsRender && { jsRender: true }) }),
      });
      const data = await res.json();

      // Fill the progress bar to 100% before showing results
      clearInterval(stepInterval);
      currentStep = STEPS.length;
      document.getElementById('progressFill').style.width = '100%';
      document.getElementById('statusText').textContent = 'Done.';
      await new Promise(resolve => setTimeout(resolve, 600));
      stopSteps();

      if (!res.ok) { handleAuditError(res, data); return; }
      renderResults(data);
      loadGscPanel(url);
      loadGa4Panel(url);
      appendRobotsPanel(url);
      showSavedNote();
      results.style.display = 'block';
      requestAnimationFrame(() => {
        results.scrollIntoView({ behavior: 'smooth' });
        requestAnimationFrame(() => results.classList.add('visible'));
      });
    } catch (err) {
      stopSteps();
      showError('Could not connect to the server. Check your internet connection and try again.');
    } finally {
      document.getElementById('auditBtn').disabled = false;
    }
  }

  function showError(msg, opts = {}) {
    const line = document.getElementById('errorLine');
    const text = document.getElementById('errorText');
    line.style.display = 'flex';
    if (opts.html) {
      text.innerHTML = msg;
    } else {
      text.textContent = msg;
    }
  }
  function clearError() {
    document.getElementById('errorLine').style.display = 'none';
    document.getElementById('errorText').innerHTML = '';
  }

  // Handle structured error responses from the server
  function handleAuditError(res, data) {
    if (res.status === 429) {
      const upgradeLink = '<a href="/account" style="color:var(--accent);text-decoration:underline;">Upgrade your plan</a> for more audits.';
      showError(`Rate limit reached. ${upgradeLink}`, { html: true });
    } else {
      showError(data.message || 'Audit failed. Check the URL and try again.');
    }
  }

  /* ── Category helpers ── */
  function resultCategory(name) {
    if (name.startsWith('[Technical]')) return 'technical';
    if (name.startsWith('[Content]'))  return 'content';
    if (name.startsWith('[AEO]'))      return 'aeo';
    if (name.startsWith('[GEO]'))      return 'geo';
    return 'technical';
  }
  function categoryOrder(name) {
    return { technical: 0, content: 1, aeo: 2, geo: 3 }[resultCategory(name)] ?? 0;
  }
  const CAT_LABELS = {
    technical: { short: 'Technical', full: 'Site Health & Infrastructure' },
    content:   { short: 'Content',   full: 'Marketing & On-Page Signals' },
    aeo:       { short: 'AEO',       full: 'Answer Engine Optimization' },
    geo:       { short: 'GEO',       full: 'Generative Engine Optimization' },
  };

  const GRADE_LABELS = {
    A: 'Excellent — strong SEO, AEO, and GEO signals across the board.',
    B: 'Good — core signals are solid; targeted AEO or GEO improvements would push this higher.',
    C: 'Average — several SEO, AEO, or GEO signals are missing or weak.',
    D: 'Poor — significant gaps in SEO foundations and AI-readiness signals.',
    F: 'Critical — foundational SEO elements and AI optimization signals are missing.',
  };

  function catScoreCell(label, score, color) {
    const grade = letterGrade(score);
    return `
      <div class="cat-score-cell" style="border-top:3px solid ${color}">
        <div class="cat-score-name" style="color:${color}">${label}</div>
        <div class="cat-score-num">${score}<span class="cat-score-denom">/100</span></div>
        <div class="cat-score-grade" style="color:${color}">${grade}</div>
        <div class="cat-mini-track"><div class="cat-mini-fill" style="width:${score}%;background:${color}"></div></div>
      </div>`;
  }

  // ── Shared score hero (audit header + grade + counter + meter + stats + category pillars) ──
  // idPrefix: 'page' | 'site'
  function buildScoreHero({ grade, score, color, pass, warn, fail, catScores, idPrefix, auditLabel, auditUrl }) {
    const p = idPrefix;
    const summary = GRADE_LABELS[grade] || '';
    return `
      <div class="site-results-header">
        <strong>${auditLabel}</strong>
        <span>·</span>
        <span>${auditUrl}</span>
      </div>
      <div class="score-hero">
        <div class="grade-display grade-${grade}" id="${p}GradeDisplay">${grade}</div>
        <div class="score-right" id="${p}ScoreRight">
          <div class="score-counter-row">
            <span id="${p}ScoreCounter">0</span><span> / 100</span>
          </div>
          <div class="score-summary-text">${summary}</div>
          <div class="meter-track">
            <div class="meter-fill" id="${p}MeterFill" style="background:${color}"></div>
          </div>
          <div class="meter-ticks">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </div>
      </div>
      <div class="stats-row" id="${p}StatsRow">
        <div class="stat-cell stat-pass"><div class="stat-n">${pass}</div><div class="stat-l">Passed</div></div>
        <div class="stat-cell stat-warn"><div class="stat-n">${warn}</div><div class="stat-l">Warnings</div></div>
        <div class="stat-cell stat-fail"><div class="stat-n">${fail}</div><div class="stat-l">Failed</div></div>
      </div>
      <div class="cat-scores-row" id="${p}CatScoresRow">
        ${catScoreCell('Technical', catScores.technical, '#8892a4')}
        ${catScoreCell('Content',   catScores.content,   '#e8a87c')}
        ${catScoreCell('AEO',       catScores.aeo,       '#7baeff')}
        ${catScoreCell('GEO',       catScores.geo,       '#b07bff')}
      </div>`;
  }

  // Animates the hero block (grade + score counter + meter) — call inside requestAnimationFrame stagger
  function animateScoreHero(idPrefix, score) {
    const p = idPrefix;
    document.getElementById(p + 'GradeDisplay')?.classList.add('in');
    document.getElementById(p + 'ScoreRight')?.classList.add('in');
    const sc = document.getElementById(p + 'ScoreCounter');
    if (sc) countUp(sc, score);
    const mf = document.getElementById(p + 'MeterFill');
    if (mf) mf.style.width = score + '%';
  }

  /* ── AI Topic Coverage ── */
  async function analyzeTopicCoverage(btn) {
    const forceRegenerate = btn.textContent.trim().startsWith('Regenerate');
    btn.disabled = true;
    btn.textContent = 'Analyzing...';
    try {
      const res = await fetch('/api/topic-coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: window._lastAuditData?.url, reportId: _currentReportId, forceRegenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        btn.textContent = data.message || 'Error';
        setTimeout(() => { btn.textContent = forceRegenerate ? 'Regenerate →' : 'Analyze Topic Coverage →'; btn.disabled = false; }, 3000);
        return;
      }
      const resultEl = document.getElementById('topicCoverageResult');
      if (resultEl) {
        resultEl.innerHTML = '<ol class="topic-gaps-list">' + (data.gaps || []).map(g => `<li class="topic-gap-item">${esc(g)}</li>`).join('') + '</ol>';
        resultEl.style.display = 'block';
      }
      btn.textContent = 'Regenerate →';
      btn.disabled = false;
    } catch {
      btn.textContent = 'Error — try again';
      setTimeout(() => { btn.textContent = forceRegenerate ? 'Regenerate →' : 'Analyze Topic Coverage →'; btn.disabled = false; }, 3000);
    }
  }

  /* ── AI Content Brief ── */
  async function generateContentBrief(btn) {
    const forceRegenerate = btn.textContent.trim().startsWith('Regenerate');
    btn.disabled = true;
    btn.textContent = 'Generating...';
    try {
      const res = await fetch('/api/content-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: window._lastAuditData?.url, reportId: _currentReportId, forceRegenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        btn.textContent = data.message || 'Error';
        setTimeout(() => { btn.textContent = forceRegenerate ? 'Regenerate →' : 'Generate Content Brief →'; btn.disabled = false; }, 3000);
        return;
      }
      _renderContentBrief(data.brief);
      btn.textContent = 'Regenerate →';
      btn.disabled = false;
    } catch {
      btn.textContent = 'Error — try again';
      setTimeout(() => { btn.textContent = forceRegenerate ? 'Regenerate →' : 'Generate Content Brief →'; btn.disabled = false; }, 3000);
    }
  }

  function _renderContentBrief(brief) {
    const el = document.getElementById('contentBriefResult');
    if (!el || !brief) return;
    const kw = (brief.targetKeywords || []).map(k => `<span class="cb-tag">${esc(k)}</span>`).join('');
    const outline = (brief.outline || []).map(s =>
      `<div class="cb-outline-row"><span class="cb-outline-heading">${esc(s.heading)}</span>${s.notes ? `<span class="cb-outline-notes">${esc(s.notes)}</span>` : ''}</div>`
    ).join('');
    const entities = (brief.mustIncludeEntities || []).map(e => `<span class="cb-tag cb-tag-entity">${esc(e)}</span>`).join('');
    const faqs = (brief.faqSuggestions || []).map(q => `<li class="topic-gap-item">${esc(q)}</li>`).join('');
    el.innerHTML = `
      ${kw ? `<div class="cb-section"><div class="cb-section-label">Target Keywords</div><div class="cb-tags">${kw}</div></div>` : ''}
      ${brief.recommendedWordCount ? `<div class="cb-section"><div class="cb-section-label">Recommended Word Count</div><div class="cb-word-count">${brief.recommendedWordCount.toLocaleString()} words</div></div>` : ''}
      ${outline ? `<div class="cb-section"><div class="cb-section-label">Outline</div>${outline}</div>` : ''}
      ${entities ? `<div class="cb-section"><div class="cb-section-label">Must-Include Entities</div><div class="cb-tags">${entities}</div></div>` : ''}
      ${faqs ? `<div class="cb-section"><div class="cb-section-label">FAQ Suggestions</div><ol class="topic-gaps-list">${faqs}</ol></div>` : ''}
      ${brief.competitorAngle ? `<div class="cb-section"><div class="cb-section-label">Competitor Angle</div><div class="cb-competitor-angle">${esc(brief.competitorAngle)}</div></div>` : ''}
    `;
    el.style.display = 'block';
  }

  /* ── JSON-LD Schema Generator ── */
  const SCHEMA_CHECK_TYPES = {
    '[Technical] Structured Data Inventory': 'LocalBusiness',
    '[Technical] BreadcrumbList Schema':     'BreadcrumbList',
    '[AEO] FAQ & Question Schema':           'FAQPage',
    '[AEO] Article Schema':                  'Article',
    '[GEO] Service / Product Schema':        'Product',
    '[GEO] Organization Entity Clarity':     'Organization',
  };
  // For Schema Required Fields we parse the details field to detect type
  function _schemaTypeFromDetails(details) {
    if (!details) return 'LocalBusiness';
    const m = String(details).match(/^(\w+):/);
    return m ? m[1] : 'LocalBusiness';
  }

  function _buildSchemaCtx() {
    const results = window._lastAuditData?.results || [];
    const url  = window._lastAuditData?.url || '';
    let origin = '';
    try { origin = new URL(url).origin; } catch {}
    const get  = (name) => results.find(r => r.name === name);
    const titleResult = get('[Content] Title Tag');
    const h1Result    = get('[Content] H1 Headings');
    const napResult   = get('[Content] NAP Consistency');
    let phone = '', address = '';
    if (napResult?.details) {
      const pm = String(napResult.details).match(/Phone[^:]*:\s*"?([^"|]+)"?/i);
      const am = String(napResult.details).match(/Address[^:]*:\s*"?([^"|]+)"?/i);
      if (pm) phone   = pm[1].trim();
      if (am) address = am[1].trim();
    }
    return {
      url, origin,
      title:   titleResult?.details?.split('\n')[0]?.trim() || '',
      h1:      h1Result?.details?.split('\n')[0]?.trim() || '',
      phone, address,
    };
  }

  function getSchemaTemplate(type, ctx) {
    const base = { '@context': 'https://schema.org' };
    switch (type) {
      case 'LocalBusiness': return { ...base, '@type': 'LocalBusiness',
        name: ctx.title || 'Your Business Name', url: ctx.url,
        telephone: ctx.phone || '+1-555-000-0000',
        address: { '@type': 'PostalAddress', streetAddress: ctx.address || '123 Main St',
          addressLocality: 'City', addressRegion: 'ST', postalCode: '00000', addressCountry: 'US' },
        description: 'Brief description of your business.' };
      case 'Organization': return { ...base, '@type': 'Organization',
        name: ctx.title || 'Organization Name', url: ctx.url,
        logo: ctx.origin + '/logo.png',
        sameAs: ['https://www.linkedin.com/company/yourco', 'https://twitter.com/yourco'],
        contactPoint: { '@type': 'ContactPoint', telephone: ctx.phone || '+1-555-000-0000', contactType: 'customer service' } };
      case 'FAQPage': return { ...base, '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: 'What is ' + (ctx.h1 || 'your service') + '?',
            acceptedAnswer: { '@type': 'Answer', text: 'A clear, concise answer here.' } },
          { '@type': 'Question', name: 'How does it work?',
            acceptedAnswer: { '@type': 'Answer', text: 'Step-by-step explanation here.' } },
        ] };
      case 'Article': return { ...base, '@type': 'Article',
        headline: ctx.h1 || ctx.title || 'Article Headline',
        author: { '@type': 'Person', name: 'Author Name' },
        publisher: { '@type': 'Organization', name: ctx.title || 'Publisher', logo: { '@type': 'ImageObject', url: ctx.origin + '/logo.png' } },
        datePublished: new Date().toISOString().slice(0, 10),
        dateModified: new Date().toISOString().slice(0, 10),
        url: ctx.url };
      case 'Product': return { ...base, '@type': 'Product',
        name: ctx.h1 || ctx.title || 'Product Name',
        description: 'Product description here.',
        url: ctx.url,
        brand: { '@type': 'Brand', name: ctx.title || 'Brand Name' },
        offers: { '@type': 'Offer', priceCurrency: 'USD', price: '0.00', availability: 'https://schema.org/InStock' } };
      case 'BreadcrumbList': return { ...base, '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: ctx.origin },
          { '@type': 'ListItem', position: 2, name: ctx.h1 || ctx.title || 'This Page', item: ctx.url },
        ] };
      default: return { ...base, '@type': type, name: ctx.title || 'Name', url: ctx.url };
    }
  }

  function showSchemaTemplate(btn, type) {
    const container = btn.closest('.row-inner');
    if (!container) return;
    let box = container.querySelector('.schema-template-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'schema-template-box';
      btn.insertAdjacentElement('afterend', box);
    }
    const ctx = _buildSchemaCtx();
    const json = JSON.stringify(getSchemaTemplate(type, ctx), null, 2);
    const escaped = esc(json);
    box.innerHTML = `<p class="schema-template-hint">Paste this inside a <code>&lt;script type="application/ld+json"&gt;</code> tag in the <code>&lt;head&gt;</code> of your page.</p>` +
      `<pre class="schema-template-pre">${escaped}</pre>` +
      `<button class="rec-btn" data-copy="${esc(json)}" ` +
      `onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500)})">Copy</button>`;
    btn.textContent = 'Refresh Template';
  }

  /* ── Issue priority map ── */
  const PRIORITY_MAP = {
    // Critical — direct indexing / ranking impact
    '[Technical] SSL / HTTPS':                    'critical',
    '[Technical] Page Indexability':              'critical',
    '[Technical] Robots.txt Safety':              'critical',
    '[Technical] Redirect Chain':                 'critical',
    '[Technical] Mixed Content':                  'critical',
    '[Technical] Mobile Viewport':                'critical',
    '[Technical] Schema Required Fields':         'critical',
    '[Technical] Core Web Vitals':                'critical',
    '[Content] Title Tag':                        'critical',
    '[Content] Meta Description':                 'critical',
    '[Content] H1 Headings':                      'critical',
    // Important — significant but not immediately ranking-breaking
    '[Technical] Page Speed':                     'important',
    '[Technical] Canonical URL':                  'important',
    '[Technical] Broken Links':                   'important',
    '[Technical] Security Headers':               'important',
    '[Technical] Sitemap Validation':             'important',
    '[Technical] Crawl Delay':                    'important',
    '[Technical] Structured Data Inventory':      'important',
    '[Content] Image Alt Text':                   'important',
    '[Content] NAP Consistency':                  'important',
    '[Content] Open Graph / Social Tags':         'important',
    '[Content] OG Image Reachability':            'important',
    '[Content] E-E-A-T Composite Score':          'important',
    '[AEO] FAQ & Question Schema':                'important',
    '[AEO] Article Schema':                       'important',
    '[AEO] Featured Snippet Format':              'important',
    '[GEO] E-E-A-T Signals':                      'important',
    '[GEO] Organization Entity Clarity':          'important',
    '[GEO] AI Crawler Access':                    'important',
    // All other checks default to 'optimize'
  };
  function getPriority(name) { return PRIORITY_MAP[name] || 'optimize'; }
  const PRIORITY_LABELS = { critical: '● Critical', important: '● Important', optimize: '● Optimize' };

  /* ── Render results ── */
  function renderResults(data) {
    window._lastAuditData = data;

    // Track report ID and pre-populate AI recs cache from saved data
    _currentReportId = data.reportId ?? data.id ?? null;
    _aiRecsCache = {};
    const savedRecs = data.ai_recs_json ?? data.aiRecs ?? null;
    if (savedRecs && typeof savedRecs === 'object') {
      Object.assign(_aiRecsCache, savedRecs);
    }
    const _cachedTopicGaps  = savedRecs?.['__topic_coverage__'] ?? null;
    const _cachedBrief      = savedRecs?.['__content_brief__']  ?? null;

    // Sort: Technical → Content → AEO → GEO, stable within each group
    const results = [...data.results].sort((a, b) => categoryOrder(a.name) - categoryOrder(b.name));

    const pass  = results.filter(r => r.status === 'pass').length;
    const warn  = results.filter(r => r.status === 'warn').length;
    const fail  = results.filter(r => r.status === 'fail').length;
    const color = gradeColor(data.totalScore);

    // Per-category average scores
    const catScores = {
      technical: calcCatAvg(results, '[Technical]'),
      content:   calcCatAvg(results, '[Content]'),
      aeo:       calcCatAvg(results, '[AEO]'),
      geo:       calcCatAvg(results, '[GEO]'),
    };

    const isPro = (_currentUser && (_currentUser.plan === 'pro' || _currentUser.plan === 'agency')) || window._sgPlan === 'pro' || window._sgPlan === 'agency';

    let html =
      buildScoreHero({
        grade: data.grade, score: data.totalScore,
        color, pass, warn, fail, catScores, idPrefix: 'page',
        auditLabel: 'Page Audit', auditUrl: esc(data.url),
      }) + `

      <!-- PDF download + exports -->
      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:32px">
        <a class="pdf-link" id="pdfLink" href="/output/${esc(data.pdfFile)}" download>
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Download PDF Report
        </a>
        <button id="exportJsonBtn" class="pdf-link" style="background:none;cursor:pointer" onclick="exportPageJSON()">
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Export JSON
        </button>
        <button id="exportCsvBtn" class="pdf-link" style="background:none;cursor:pointer" onclick="exportPageCSV()">
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Export CSV
        </button>
      </div>

      ${(data.aiSummary || data.ai_summary) ? `
      <div class="ai-summary-card" id="pageAiSummaryCard">
        <div class="ai-summary-label">AI Executive Summary</div>
        <div class="ai-summary-text">${esc(data.aiSummary || data.ai_summary)}</div>
      </div>` : window._sgPlan === 'free' ? `
      <div class="ai-summary-card ai-summary-locked" id="pageAiSummaryCard">
        <div class="ai-summary-label">AI Executive Summary</div>
        <div class="ai-summary-text ai-summary-blur">Upgrade to Pro for an AI-generated summary with specific recommendations for this page.</div>
        <a href="/pricing" class="ai-summary-upgrade">Upgrade to Pro →</a>
      </div>` : `
      <div class="ai-summary-card" id="pageAiSummaryCard" style="opacity:0.5">
        <div class="ai-summary-label">AI Executive Summary</div>
        <div class="ai-summary-text" style="color:var(--muted)">AI summary unavailable for this audit — check your GROQ_API_KEY.</div>
      </div>`}

      ${isPro ? `
      <div class="ai-summary-card" id="topicCoverageCard" style="opacity:0;margin-top:4px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div class="ai-summary-label">AI Topic Coverage Analysis</div>
          <button class="rec-btn generate-btn" id="topicCoverageBtn" onclick="analyzeTopicCoverage(this)">Analyze Topic Coverage →</button>
        </div>
        <div id="topicCoverageResult" style="display:none;margin-top:10px"></div>
      </div>
      <div class="ai-summary-card" id="contentBriefCard" style="opacity:0;margin-top:4px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div class="ai-summary-label">AI Content Brief</div>
          <button class="rec-btn generate-btn" id="contentBriefBtn" onclick="generateContentBrief(this)">Generate Content Brief →</button>
        </div>
        <div id="contentBriefResult" style="display:none;margin-top:12px"></div>
      </div>` : ''}

      ${(function() {
        // SERP Snippet Preview — pull title and meta description from audit results
        const titleResult = results.find(r => r.name === '[Content] Title Tag');
        const metaResult  = results.find(r => r.name === '[Content] Meta Description');
        const serpTitle   = titleResult?.details || '';
        const serpDesc    = metaResult?.details  || '';
        let serpUrl = '';
        try {
          const u = new URL(data.url);
          serpUrl = (u.hostname + u.pathname).replace(/\/$/, '') || u.hostname;
        } catch { serpUrl = data.url; }

        const titleLen   = serpTitle.length;
        const descLen    = serpDesc.length;
        const titleColor = titleLen > 70 ? 'var(--fail)' : titleLen > 60 ? 'var(--warn)' : titleLen > 0 ? 'var(--pass)' : 'var(--muted)';
        const descColor  = descLen > 180  ? 'var(--fail)' : descLen > 160  ? 'var(--warn)' : descLen > 0  ? 'var(--pass)' : 'var(--muted)';

        return `<div class="serp-preview-card" id="serpPreview">
          <div class="serp-preview-label">SERP Preview</div>
          <div class="serp-card-inner">
            <div class="serp-url-line">${esc(serpUrl)}</div>
            <div class="serp-title-line">${serpTitle ? esc(serpTitle) : '<span style="color:var(--muted);font-style:italic">No title tag</span>'}</div>
            <div class="serp-desc-line">${serpDesc ? esc(serpDesc) : '<span style="color:var(--muted);font-style:italic">No meta description</span>'}</div>
          </div>
          <div class="serp-char-counts">
            <span>Title: <span style="color:${titleColor}">${titleLen} / 60 chars</span></span>
            <span>Description: <span style="color:${descColor}">${descLen} / 160 chars</span></span>
          </div>
        </div>`;
      })()}

      ${(function() {
        const fails = results.filter(r => r.status === 'fail');
        if (!fails.length) return '';
        const totalChecks = results.length;
        // High Impact first (maxScore > 50), then Quick Wins
        const highImpact = fails.filter(r => (r.maxScore ?? 100) > 50)
          .sort((a, b) => (a.normalizedScore ?? 0) - (b.normalizedScore ?? 0));
        const quickWins = fails.filter(r => (r.maxScore ?? 100) <= 50)
          .sort((a, b) => (a.normalizedScore ?? 0) - (b.normalizedScore ?? 0));
        const topFails = [...highImpact, ...quickWins].slice(0, 5);
        const items = topFails.map((r, i) => {
          const name = stripAuditPrefix(r.name);
          const gain = Math.max(1, Math.round((100 - (r.normalizedScore ?? 0)) / totalChecks));
          const isHighImpact = (r.maxScore ?? 100) > 50;
          const label = isHighImpact ? 'High Impact' : 'Quick Win';
          const labelColor = isHighImpact ? 'var(--fail)' : 'var(--warn)';
          const msg = r.message || r.recommendation || '';
          return `<li class="top-issues-item">
            <span class="top-issues-num">${i + 1}</span>
            <div class="top-issues-body">
              <div class="top-issues-name">${esc(name)}
                <span class="top-issues-label" style="color:${labelColor}">${label}</span>
              </div>
              ${msg ? `<div class="top-issues-msg">${esc(msg)}</div>` : ''}
            </div>
            <span class="top-issues-score">+${gain} pts</span>
          </li>`;
        }).join('');
        return `<div class="top-issues" id="topIssues">
          <div class="top-issues-title">Fix These First</div>
          <ol class="top-issues-list">${items}</ol>
        </div>`;
      })()}

      <!-- Horizontal card strip -->
      <div class="cards-label" id="cardsLabel">Check Results</div>
      <div class="cards-strip" id="cardStrip">`;

    let lastCat = null;
    for (const r of results) {
      const cat = resultCategory(r.name);
      if (cat !== lastCat) {
        if (lastCat !== null) {
          html += `<div class="card-cat-sep"><div class="card-cat-sep-inner cat-${cat}">${CAT_LABELS[cat].short}</div></div>`;
        }
        lastCat = cat;
      }
      const hasScore = r.normalizedScore !== null && r.normalizedScore !== undefined;
      const scoreDisplay = hasScore ? r.normalizedScore : '—';
      const barWidth = hasScore ? r.normalizedScore : 0;
      // Strip category prefix from card name display
      const displayName = stripAuditPrefix(r.name);
      html += `
        <div class="audit-card ${r.status}">
          <div class="card-icon">${statusIcon(r.status)}</div>
          <div class="card-name">${esc(displayName)}</div>
          <div class="card-score-val">${scoreDisplay}${hasScore ? '<span style="font-size:12px;color:var(--muted)">/100</span>' : ''}</div>
          <div class="card-bar"><div class="card-bar-fill" style="width:${barWidth}%"></div></div>
          <div class="card-msg">${esc((r.message || '').split('\n')[0])}</div>
        </div>`;
    }

    html += `</div>

      <!-- Detail rows -->
      <div class="detail-label" id="detailLabel">Detailed Findings</div>
      <div class="result-rows" id="resultRows">`;

    lastCat = null;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const cat = resultCategory(r.name);
      if (cat !== lastCat) {
        const catInfo = CAT_LABELS[cat];
        html += `<div class="detail-cat-header cat-${cat}">${catInfo.short} <span class="cat-full">— ${catInfo.full}</span></div>`;
        lastCat = cat;
      }
      const hasScore = r.normalizedScore !== null && r.normalizedScore !== undefined;
      const isTitle = r.name === '[Content] Title Tag';
      const isMetaDesc = r.name === '[Content] Meta Description';
      const showGenerate = (isTitle || isMetaDesc) && r.status !== 'pass' && _currentUser && (_currentUser.plan === 'pro' || _currentUser.plan === 'agency');
      const generateType = isTitle ? 'title' : 'description';
      const showAiFix = r.status !== 'pass' && r.recommendation && !isTitle && !isMetaDesc && isPro;
      const priority = r.status !== 'pass' ? getPriority(r.name) : null;
      html += `
        <div class="result-row">
          <div class="row-status ${r.status}">${statusIcon(r.status)}</div>
          <div class="row-inner">
            <div class="row-name">${esc(r.name)}</div>
            ${priority ? `<span class="priority-badge priority-${priority}">${PRIORITY_LABELS[priority]}</span>` : ''}
            ${r.message ? `<div class="row-msg">${esc(r.message)}</div>` : ''}
            ${r.details  ? (() => {
              const lines = String(r.details).split('\n');
              if (lines.length > 8) {
                const detailId = 'detail-extra-' + i;
                return `<div class="row-detail">${esc(lines.slice(0, 8).join('\n'))}</div>` +
                  `<div class="row-detail" id="${detailId}" style="display:none">${esc(lines.slice(8).join('\n'))}</div>` +
                  `<button class="rec-btn" data-count="${lines.length - 8}" onclick="toggleDetail('${detailId}', this)">+ ${lines.length - 8} more</button>`;
              }
              return `<div class="row-detail">${esc(r.details)}</div>`;
            })() : ''}
            ${r.recommendation ? `
              <button class="rec-btn" onclick="toggleRec(${i})">+ recommendation</button>
              <div class="row-rec" id="rec${i}">${esc(r.recommendation)}</div>` : ''}
            ${showGenerate ? `<button class="rec-btn generate-btn" onclick="generateMeta(${JSON.stringify(data.url)}, '${generateType}', this)">Generate →</button>` : ''}
            ${showAiFix ? `<button class="rec-btn generate-btn ai-fix-btn" data-url="${esc(data.url)}" data-check="${esc(r.name)}" data-msg="${esc(r.message || '')}" data-details="${esc(r.details || '')}" onclick="aiFixRec(this.dataset.url,this.dataset.check,this.dataset.msg,this.dataset.details,this)">AI Fix →</button>` : ''}
            ${(() => {
              if (r.status === 'pass') return '';
              let schemaType = SCHEMA_CHECK_TYPES[r.name];
              if (!schemaType && r.name === '[Technical] Schema Required Fields') schemaType = _schemaTypeFromDetails(r.details);
              if (!schemaType) return '';
              return `<button class="rec-btn generate-btn" style="color:#b07bff;border-color:#b07bff" onclick="showSchemaTemplate(this,'${schemaType}')">Get Schema Template →</button>`;
            })()}
            ${hasScore ? `<div class="row-bar"><div class="row-bar-fill" style="width:${r.normalizedScore}%;background:${r.status === 'pass' ? 'var(--pass)' : r.status === 'warn' ? 'var(--warn)' : 'var(--fail)'}"></div></div>` : ''}
          </div>
          <div class="row-score-val ${r.status}">${hasScore ? r.normalizedScore + '/100' : ''}</div>
        </div>`;
    }

    html += `</div>`;
    document.getElementById('resultsInner').innerHTML = html;

    /* Trigger animations after paint — hero all at once, then cascade */
    requestAnimationFrame(() => {
      setTimeout(() => animateScoreHero('page', data.totalScore), 100);
      setTimeout(() => { document.getElementById('pageStatsRow').classList.add('in'); }, 350);
      setTimeout(() => { document.getElementById('pageCatScoresRow').classList.add('in'); }, 500);
      setTimeout(() => {
        document.getElementById('pdfLink').classList.add('in');
        const ej = document.getElementById('exportJsonBtn'); if (ej) ej.classList.add('in');
        const ec = document.getElementById('exportCsvBtn');  if (ec) ec.classList.add('in');
        const sp = document.getElementById('serpPreview');   if (sp) sp.classList.add('in');
      }, 600);
      setTimeout(() => { document.getElementById('pageAiSummaryCard')?.classList.add('in'); }, 650);
      setTimeout(() => {
        const tc = document.getElementById('topicCoverageCard');
        if (tc) { tc.style.opacity = ''; tc.classList.add('in'); }
        // Pre-populate cached topic gaps
        if (_cachedTopicGaps?.length) {
          const resultEl = document.getElementById('topicCoverageResult');
          const btn = document.getElementById('topicCoverageBtn');
          if (resultEl) {
            resultEl.innerHTML = '<ol class="topic-gaps-list">' + _cachedTopicGaps.map(g => `<li class="topic-gap-item">${esc(g)}</li>`).join('') + '</ol>';
            resultEl.style.display = 'block';
          }
          if (btn) btn.textContent = 'Regenerate →';
        }
        // Content brief card
        const cb = document.getElementById('contentBriefCard');
        if (cb) { cb.style.opacity = ''; cb.classList.add('in'); }
        if (_cachedBrief) {
          _renderContentBrief(_cachedBrief);
          const cbBtn = document.getElementById('contentBriefBtn');
          if (cbBtn) cbBtn.textContent = 'Regenerate →';
        }
      }, 700);
      setTimeout(() => { const el = document.getElementById('topIssues'); if (el) el.classList.add('in'); }, 700);
      setTimeout(() => { document.getElementById('cardsLabel').classList.add('in'); }, 750);
      setTimeout(() => { document.getElementById('cardStrip').classList.add('in'); }, 800);
      setTimeout(() => { document.getElementById('detailLabel').classList.add('in'); }, 850);
      setTimeout(() => { document.getElementById('resultRows').classList.add('in'); }, 900);
    });
  }

  /* ── Multi-location audit ── */

  // Dynamic input rows
  function addMultiRow(url = '', label = '') {
    const wrap = document.getElementById('multiLocRows');
    if (wrap.querySelectorAll('.multi-loc-row').length >= _multiLimit) return;
    const row  = document.createElement('div');
    row.className = 'multi-loc-row';
    row.innerHTML = `
      <input type="text" class="multi-loc-label" placeholder="Label (optional)" value="${esc(label)}" autocomplete="off" />
      <input type="url" class="multi-loc-url" placeholder="https://location.com" value="${esc(url)}" autocomplete="off" spellcheck="false" />
      <button class="multi-loc-remove" onclick="removeMultiRow(this)" title="Remove">×</button>`;
    wrap.appendChild(row);
  }

  function removeMultiRow(btn) {
    const rows = document.querySelectorAll('.multi-loc-row');
    if (rows.length <= 1) return; // keep at least one row
    btn.closest('.multi-loc-row').remove();
  }

  function getMultiLocations() {
    return [...document.querySelectorAll('.multi-loc-row')].map(row => ({
      url:   row.querySelector('.multi-loc-url').value.trim(),
      label: row.querySelector('.multi-loc-label').value.trim(),
    })).filter(l => l.url.length > 0);
  }

  // localStorage history for score delta
  const MULTI_HISTORY_KEY = 'sg_multi_history';

  function getMultiHistory(locs) {
    const key = locs.map(l => l.url).sort().join('|');
    try {
      const store = JSON.parse(localStorage.getItem(MULTI_HISTORY_KEY) || '{}');
      return store[key] || null;
    } catch { return null; }
  }

  function saveMultiHistory(locations) {
    const key = locations.map(l => l.url).sort().join('|');
    try {
      const store = JSON.parse(localStorage.getItem(MULTI_HISTORY_KEY) || '{}');
      store[key] = { date: new Date().toISOString(), scores: Object.fromEntries(locations.map(l => [l.url, l.totalScore])) };
      localStorage.setItem(MULTI_HISTORY_KEY, JSON.stringify(store));
    } catch {}
  }

  async function runMultiAudit() {
    const locs = getMultiLocations();
    if (locs.length === 0) { showError('Enter at least one URL.'); return; }
    if (locs.length > _multiLimit) { showError(`Your plan allows up to ${_multiLimit} URLs per audit.`); return; }

    const urls = locs.map(l => l.url.toLowerCase().replace(/\/+$/, ''));
    const seen = new Set();
    const dupes = [];
    for (const u of urls) {
      if (seen.has(u)) dupes.push(u);
      else seen.add(u);
    }
    if (dupes.length) {
      showError(`Duplicate URL${dupes.length > 1 ? 's' : ''} detected — each location must be unique: ${dupes.join(', ')}`);
      return;
    }

    const prevHistory = getMultiHistory(locs);

    clearError();
    document.getElementById('multiAuditBtn').disabled = true;
    const resultsSection = document.getElementById('results');
    resultsSection.style.display = 'none';
    resultsSection.classList.remove('visible');

    startSteps();

    try {
      const res  = await fetch('/multi-audit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ locations: locs }),
      });
      const data = await res.json();

      document.getElementById('progressFill').style.width = '100%';
      document.getElementById('statusText').textContent = 'Done.';
      await new Promise(resolve => setTimeout(resolve, 600));
      stopSteps();

      if (!res.ok) { handleAuditError(res, data); return; }
      renderMultiResults(data, prevHistory);
      saveMultiHistory(data.locations.filter(l => !l.error));
      showSavedNote();
      resultsSection.style.display = 'block';
      requestAnimationFrame(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        requestAnimationFrame(() => resultsSection.classList.add('visible'));
      });
    } catch (err) {
      stopSteps();
      showError('Could not connect to the server. Check your internet connection and try again.');
    } finally {
      document.getElementById('multiAuditBtn').disabled = false;
    }
  }

  // Display name: label if set, otherwise domain
  function multiDisplayName(loc) {
    return (loc.label && loc.label.trim()) ? loc.label.trim() : toDomain(loc.url);
  }

  function renderNapSection(locations) {
    const successLocs = locations.filter(l => !l.error && l.nap);
    if (!successLocs.length) return '';

    const rows = successLocs.map(loc => ({
      label:   multiDisplayName(loc),
      phone:   loc.nap.phone   || '—',
      address: loc.nap.address || '—',
    }));

    const phones    = rows.map(r => r.phone).filter(v => v !== '—');
    const addresses = rows.map(r => r.address).filter(v => v !== '—');
    const phoneMismatch   = new Set(phones).size > 1;
    const addressMismatch = new Set(addresses).size > 1;
    if (!phoneMismatch && !addressMismatch && phones.length === 0 && addresses.length === 0) return '';

    const majorityOf = (arr) => arr.length ? arr.sort((a, b) => arr.filter(v => v === b).length - arr.filter(v => v === a).length)[0] : null;
    const majPhone   = majorityOf(phones);
    const majAddress = majorityOf(addresses);

    const headerNote = (phoneMismatch || addressMismatch) ? ' <span style="color:var(--fail);font-size:10px">— mismatches detected</span>' : '';
    let html = `<div class="nap-section">
      <div class="detail-label in">NAP Consistency${headerNote}</div>
      <table class="nap-cmp-table">
        <thead><tr><th>Location</th><th>Phone</th><th>Address</th></tr></thead>
        <tbody>`;
    for (const row of rows) {
      const pMismatch = phoneMismatch   && row.phone   !== '—' && row.phone   !== majPhone;
      const aMismatch = addressMismatch && row.address !== '—' && row.address !== majAddress;
      html += `<tr>
        <td class="nap-loc">${esc(row.label)}</td>
        <td${pMismatch ? ' class="nap-cell-mismatch"' : ''}>${esc(row.phone)}</td>
        <td${aMismatch ? ' class="nap-cell-mismatch"' : ''}>${esc(row.address)}</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
    return html;
  }

  // CSV export
  function exportMultiCSV(locations, sortedNames) {
    const headers = ['Check', 'Category', ...locations.map(loc => multiDisplayName(loc))];
    const rows = sortedNames.map(name => {
      const cat = resultCategory(name);
      const displayName = stripAuditPrefix(name);
      const statuses = locations.map(loc => {
        if (loc.error) return 'error';
        const r = (loc.results || []).find(x => x.name === name);
        return r ? r.status : 'n/a';
      });
      return [displayName, CAT_LABELS[cat].short, ...statuses];
    });
    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'searchgrade-multi-comparison.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // Sitemap XML export (site audit)
  let _latestSiteResults = [];
  let _latestSiteUrl     = '';
  function downloadSitemapXml() {
    const urlSet = new Set();
    for (const r of _latestSiteResults) {
      for (const u of [...(r.fail || []), ...(r.warn || []), ...(r.pass || [])]) {
        if (u && u.startsWith('http')) urlSet.add(u);
      }
    }
    if (!urlSet.size) { alert('No crawled URLs found.'); return; }
    const locs = [...urlSet].map(u => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n');
    const xml  = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs}\n</urlset>`;
    const blob = new Blob([xml], { type: 'application/xml' });
    const href = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    try {
      const host = new URL(_latestSiteUrl).hostname.replace(/[^a-z0-9.-]/gi, '-');
      a.download = `sitemap-${host}.xml`;
    } catch { a.download = 'sitemap.xml'; }
    a.href = href; a.click();
    URL.revokeObjectURL(href);
  }

  // Table filter
  let _multiFilter = 'all';
  let _multiSortedNames = [];
  let _multiLocations   = [];
  function filterMultiTable(filter) {
    _multiFilter = filter;
    document.querySelectorAll('.multi-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    const tbody = document.getElementById('multiCmpTbody');
    if (!tbody) return;
    const rows  = tbody.querySelectorAll('tr.multi-data-row');
    rows.forEach(row => {
      if (filter === 'all') { row.style.display = ''; return; }
      const statuses = [...row.querySelectorAll('.multi-cell-icon')].map(el => {
        if (el.classList.contains('pass')) return 'pass';
        if (el.classList.contains('warn')) return 'warn';
        if (el.classList.contains('fail')) return 'fail';
        return 'na';
      });
      const hasFail = statuses.includes('fail');
      const hasWarn = statuses.includes('warn');
      row.style.display = (filter === 'fails' && hasFail) || (filter === 'warns' && !hasFail && hasWarn) ? '' : 'none';
    });
  }

  function renderMultiResults({ locations, pdfFile }, prevHistory) {
    const CAT_ORDER = ['[Technical]', '[Content]', '[AEO]', '[GEO]'];

    // Collect all unique check names in category order
    const allNames = new Set();
    for (const loc of locations) {
      if (!loc.error) for (const r of (loc.results || [])) allNames.add(r.name);
    }
    const sortedNames = [...allNames].sort((a, b) => {
      const ia = CAT_ORDER.findIndex(p => a.startsWith(p));
      const ib = CAT_ORDER.findIndex(p => b.startsWith(p));
      if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.localeCompare(b);
    });
    _multiSortedNames = sortedNames;
    _multiLocations   = locations;

    // Per-location category averages
    function catAvg(loc, prefix) {
      return loc.error ? 0 : calcCatAvg(loc.results || [], prefix);
    }

    // Location cards
    let cardsHtml = `<div class="multi-loc-cards" id="multiLocCards">`;
    for (const loc of locations) {
      const color     = loc.error ? 'var(--muted)' : gradeColor(loc.totalScore);
      const grade     = loc.error ? '—' : loc.grade;
      const score     = loc.error ? '—' : loc.totalScore;
      const dispName  = multiDisplayName(loc);
      const technical = catAvg(loc, '[Technical]');
      const content   = catAvg(loc, '[Content]');
      const aeo       = catAvg(loc, '[AEO]');
      const geo       = catAvg(loc, '[GEO]');
      let deltaHtml = '';
      if (!loc.error && prevHistory && prevHistory.scores) {
        const prev = prevHistory.scores[loc.url];
        if (prev != null && prev !== loc.totalScore) {
          const diff = loc.totalScore - prev;
          deltaHtml = `<span class="score-delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '↑' : '↓'}${Math.abs(diff)}</span>`;
        }
      }
      cardsHtml += `
        <div class="multi-loc-card" style="border-top-color:${color}">
          <div class="multi-loc-domain">${esc(dispName)}</div>
          <div class="multi-loc-grade" style="color:${color}">${grade}</div>
          <div class="multi-loc-score" style="color:${color}">${score}${!loc.error ? `<span class="multi-loc-denom">/100</span>${deltaHtml}` : ''}</div>
          ${!loc.error ? `<div class="multi-loc-meter"><div class="multi-loc-meter-fill" style="width:${score}%;background:${color}"></div></div>` : ''}
          ${!loc.error ? `
          <div class="multi-loc-cats">
            <span class="multi-loc-cat" style="color:#8892a4">T&nbsp;${technical}</span>
            <span class="multi-loc-cat" style="color:#e8a87c">C&nbsp;${content}</span>
            <span class="multi-loc-cat" style="color:#7baeff">A&nbsp;${aeo}</span>
            <span class="multi-loc-cat" style="color:#b07bff">G&nbsp;${geo}</span>
          </div>` : `<div class="multi-loc-error">${esc(loc.error)}</div>`}
        </div>`;
    }
    cardsHtml += `</div>`;

    // Downloads row (PDF + CSV)
    const csvBtn = `<button class="pdf-link" style="background:none;cursor:pointer" onclick="exportMultiCSV(_multiLocations,_multiSortedNames)">
      <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      Download CSV
    </button>`;
    const pdfBtn = pdfFile ? `<a class="pdf-link" href="/output/${esc(pdfFile)}" download>
      <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      Download Comparison PDF
    </a>` : '';
    const downloadsHtml = (pdfBtn || csvBtn) ? `<div id="multiExports" style="display:flex;gap:16px;justify-content:center;margin-bottom:32px">${pdfBtn}${csvBtn}</div>` : '';

    // NAP cross-comparison section
    const napHtml = renderNapSection(locations);

    // Common issues: checks failing at the most locations, ranked
    const CAT_COLORS_UI = { technical: '#8892a4', content: '#e8a87c', aeo: '#7baeff', geo: '#b07bff' };
    const commonIssues = sortedNames
      .map(name => {
        const failCount = locations.filter(loc => !loc.error && (loc.results || []).some(r => r.name === name && r.status === 'fail')).length;
        const warnCount = locations.filter(loc => !loc.error && (loc.results || []).some(r => r.name === name && r.status === 'warn')).length;
        return { name, failCount, warnCount };
      })
      .filter(c => c.failCount > 0)
      .sort((a, b) => b.failCount - a.failCount || b.warnCount - a.warnCount)
      .slice(0, 7);

    let commonIssuesHtml = '';
    if (commonIssues.length) {
      commonIssuesHtml = `<div class="detail-label in">Common Issues</div><div class="result-rows in">`;
      for (const issue of commonIssues) {
        const cat = resultCategory(issue.name);
        const dispName = stripAuditPrefix(issue.name);
        commonIssuesHtml += `
          <div class="result-row">
            <div class="row-status fail">${statusIcon('fail')}</div>
            <div>
              <div class="row-name">${esc(dispName)}</div>
              <div class="site-issue-cat cat-${cat}">${CAT_LABELS[cat].short}</div>
            </div>
            <div class="site-issue-counts">
              <span class="site-count-fail" style="font-size:12px">${issue.failCount}/${locations.length} locations</span>
              ${issue.warnCount ? `<span class="site-count-warn" style="font-size:11px">+${issue.warnCount} warn</span>` : ''}
            </div>
          </div>`;
      }
      commonIssuesHtml += `</div>`;
    }

    // Comparison table with filter buttons
    _multiFilter = 'all';
    const isTwoLoc = locations.length === 2;
    const colHeaders = locations.map(loc => `<th>${esc(multiDisplayName(loc))}</th>`).join('');
    const stagingNote = isTwoLoc ? `
      <div class="staging-diff-note">
        Staging vs. Production mode — rows where scores differ by 10+ pts are highlighted:
        <span style="color:var(--pass);font-weight:600">■</span> URL 1 leads &nbsp;
        <span style="color:var(--fail);font-weight:600">■</span> URL 2 leads
      </div>` : '';
    let tableHtml = `
      <div class="detail-label in" style="margin-top:32px">Check Comparison</div>
      ${stagingNote}
      <div class="multi-table-filter">
        <span class="multi-filter-label">Show:</span>
        <button class="multi-filter-btn active" data-filter="all"   onclick="filterMultiTable('all')">All</button>
        <button class="multi-filter-btn"         data-filter="fails" onclick="filterMultiTable('fails')">Fails</button>
        <button class="multi-filter-btn"         data-filter="warns" onclick="filterMultiTable('warns')">Warns</button>
      </div>
      <div class="multi-cmp-wrap">
        <table class="multi-cmp-table">
          <thead>
            <tr>
              <th class="th-check">Check</th>
              ${colHeaders}
            </tr>
          </thead>
          <tbody id="multiCmpTbody">`;

    let lastCat = null;
    for (const name of sortedNames) {
      const cat = resultCategory(name);
      if (cat !== lastCat) {
        const colSpan = locations.length + 1;
        tableHtml += `<tr class="multi-cmp-cat-row cat-${cat}"><td colspan="${colSpan}">${CAT_LABELS[cat].short} — ${CAT_LABELS[cat].full}</td></tr>`;
        lastCat = cat;
      }
      const dispName = stripAuditPrefix(name);
      const cells = locations.map(loc => {
        if (loc.error) return `<td class="td-loc"><span class="multi-cell-icon" style="color:var(--muted)">—</span></td>`;
        const r = (loc.results || []).find(x => x.name === name);
        if (!r) return `<td class="td-loc"><span class="multi-cell-icon" style="color:var(--muted)">—</span></td>`;
        const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '△' : '✕';
        const hasScore = r.normalizedScore != null;
        return `<td class="td-loc">
          <span class="multi-cell-icon ${r.status}">${icon}</span>
          ${hasScore ? `<div class="multi-cell-score">${r.normalizedScore}</div>` : ''}
        </td>`;
      }).join('');
      let rowStyle = '';
      if (isTwoLoc) {
        const r0 = !locations[0].error ? (locations[0].results || []).find(x => x.name === name) : null;
        const r1 = !locations[1].error ? (locations[1].results || []).find(x => x.name === name) : null;
        const s0 = r0?.normalizedScore ?? null;
        const s1 = r1?.normalizedScore ?? null;
        if (s0 !== null && s1 !== null && Math.abs(s0 - s1) >= 10) {
          const color = s0 > s1 ? 'var(--pass)' : 'var(--fail)';
          rowStyle = ` style="border-left:3px solid ${color}"`;
        }
      }
      tableHtml += `<tr class="multi-data-row"${rowStyle}><td class="td-check">${esc(dispName)}</td>${cells}</tr>`;
    }

    tableHtml += `</tbody></table></div>`;

    document.getElementById('resultsInner').innerHTML = `
      <div class="site-results-wrap">
        <div class="site-results-header">
          <strong>${locations.length} location${locations.length !== 1 ? 's' : ''} audited</strong>
        </div>
        ${cardsHtml}
        ${downloadsHtml}
        ${napHtml}
        ${commonIssuesHtml}
        <div id="multiBreakdown">${tableHtml}</div>
      </div>`;

    /* Trigger multi audit animations */
    requestAnimationFrame(() => {
      setTimeout(() => { document.getElementById('multiLocCards')?.classList.add('in'); }, 100);
      setTimeout(() => { document.getElementById('multiExports')?.querySelectorAll('.pdf-link').forEach(el => el.classList.add('in')); }, 300);
      setTimeout(() => { document.getElementById('multiBreakdown')?.classList.add('in'); }, 500);
    });
  }

  /* ── Site audit ── */
  function runSiteAudit(url) {
    clearError();
    document.getElementById('auditBtn').disabled = true;
    const resultsSection = document.getElementById('results');
    resultsSection.style.display = 'none';
    resultsSection.classList.remove('visible');
    showProgressUI();
    document.getElementById('statusText').textContent = 'Starting crawl...';

    const es = new EventSource(`/crawl?url=${encodeURIComponent(url)}`);
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data);
      if (evt.type === 'progress') {
        const pct = Math.min(Math.round((evt.crawled / evt.total) * 100), 99);
        document.getElementById('progressFill').style.width = pct + '%';
        document.getElementById('statusText').textContent = `Crawling page ${evt.crawled + 1} — ${evt.url}`;
      } else if (evt.type === 'done') {
        es.close();
        document.getElementById('progressFill').style.width = '100%';
        document.getElementById('statusText').textContent = 'Done.';
        setTimeout(() => {
          document.getElementById('statusLine').style.display = 'none';
          document.getElementById('progressTrack').style.display = 'none';
          renderSiteResults({ ...evt, siteUrl: url });
          showSavedNote();
          resultsSection.style.display = 'block';
          requestAnimationFrame(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth' });
            requestAnimationFrame(() => resultsSection.classList.add('visible'));
          });
          document.getElementById('auditBtn').disabled = false;
        }, 600);
      } else if (evt.type === 'error') {
        es.close();
        document.getElementById('statusLine').style.display = 'none';
        document.getElementById('progressTrack').style.display = 'none';
        showError(evt.message);
        document.getElementById('auditBtn').disabled = false;
      }
    };
    es.onerror = () => {
      es.close();
      document.getElementById('statusLine').style.display = 'none';
      document.getElementById('progressTrack').style.display = 'none';
      showError('Connection lost during crawl.');
      document.getElementById('auditBtn').disabled = false;
    };
  }

  function renderSiteResults({ pageCount, results, siteUrl, pdfFile, depthDistribution, dirCounts, linkEquity, responseStats, aiSummary, linkOpportunities, graphNodes, graphLinks }) {
    _latestSiteResults = results;
    _latestSiteUrl     = siteUrl;
    window._lastSiteData = { results, siteUrl };
    window._lastGraphData = graphNodes && graphLinks ? { nodes: graphNodes, links: graphLinks } : null;
    const checksWithFail = results.filter(r => r.fail.length > 0).length;
    const checksWarnOnly = results.filter(r => r.fail.length === 0 && r.warn.length > 0).length;
    const checksAllPass  = results.filter(r => r.fail.length === 0 && r.warn.length === 0).length;

    // Site health score: per-check weighted average (pass=100, warn=50, fail=0)
    const siteScore = results.length ? Math.round(
      results.reduce((sum, r) => {
        const t = r.pass.length + r.warn.length + r.fail.length;
        return sum + (t ? (r.pass.length + r.warn.length * 0.5) / t * 100 : 100);
      }, 0) / results.length
    ) : 0;
    const grade  = letterGrade(siteScore);
    const gColor = gradeColor(siteScore);

    // Per-category average scores
    function siteCatAvg(prefix) {
      const items = results.filter(r => r.name.startsWith(prefix));
      if (!items.length) return 0;
      const scores = items.map(r => {
        const t = r.fail.length + r.warn.length + r.pass.length || pageCount;
        return (r.pass.length + r.warn.length * 0.5) / t * 100;
      });
      return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
    const siteCatScores = {
      technical: siteCatAvg('[Technical]'),
      content:   siteCatAvg('[Content]'),
      aeo:       siteCatAvg('[AEO]'),
      geo:       siteCatAvg('[GEO]'),
    };

    // Sort by category for the breakdown
    const sorted = [...results].sort((a, b) => categoryOrder(a.name) - categoryOrder(b.name));

    // Top 7 issues by fail count
    const topIssues = [...results].filter(r => r.fail.length > 0)
      .sort((a, b) => b.fail.length - a.fail.length).slice(0, 7);

    function pct(n) { return Math.round(n / (pageCount || 1) * 100); }

    let html = `
      <div class="site-results-wrap">
        ${buildScoreHero({
          grade, score: siteScore,
          color: gColor, pass: checksAllPass, warn: checksWarnOnly, fail: checksWithFail,
          catScores: siteCatScores, idPrefix: 'site',
          auditLabel: `${pageCount} page${pageCount !== 1 ? 's' : ''} crawled`,
          auditUrl: esc(siteUrl),
        })}

        <div id="siteExports" style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:32px">
          ${pdfFile ? `<a class="pdf-link" href="/output/${esc(pdfFile)}" download>
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Download PDF Report
          </a>` : ''}
          <button class="pdf-link" style="background:none;cursor:pointer" onclick="downloadSitemapXml()">
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Download Sitemap XML
          </button>
          <button class="pdf-link" style="background:none;cursor:pointer" onclick="exportSiteJSON()">
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Export JSON
          </button>
          <button class="pdf-link" style="background:none;cursor:pointer" onclick="exportSiteCSV()">
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Export CSV
          </button>
          <button class="pdf-link" style="background:none;cursor:pointer" onclick="exportCrawlXLSX()">
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Export XLSX
          </button>
        </div>`;

    // AI Executive Summary (pro/agency)
    if (aiSummary) {
      html += `
        <div class="ai-summary-card" id="aiSummaryCard">
          <div class="ai-summary-label">AI Executive Summary</div>
          <div class="ai-summary-text">${esc(aiSummary)}</div>
        </div>`;
    } else if (window._sgPlan === 'free') {
      html += `
        <div class="ai-summary-card ai-summary-locked" id="aiSummaryCard">
          <div class="ai-summary-label">AI Executive Summary</div>
          <div class="ai-summary-text ai-summary-blur">Upgrade to Pro for an AI-generated executive summary with specific recommendations for this site.</div>
          <a href="/pricing" class="ai-summary-upgrade">Upgrade to Pro →</a>
        </div>`;
    }

    // Site Architecture panels
    const hasArchData = (depthDistribution && Object.keys(depthDistribution).length > 0) ||
                        (dirCounts && Object.keys(dirCounts).length > 0) ||
                        (linkEquity && linkEquity.length > 0);
    if (hasArchData) {
      html += `<div class="detail-label in" style="margin-top:32px">Site Architecture</div><div class="site-arch-panels">`;

      // Click Depth Distribution
      if (depthDistribution && Object.keys(depthDistribution).length > 0) {
        const maxDepth = Math.max(...Object.keys(depthDistribution).map(Number));
        const depthRows = [];
        for (let d = 0; d <= maxDepth; d++) {
          const count = depthDistribution[d] || 0;
          const barPct = Math.round(count / pageCount * 100);
          const depthColor = d >= 4 ? 'var(--fail)' : d === 3 ? 'var(--warn)' : 'var(--pass)';
          depthRows.push(`
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:48px;text-align:right">Depth ${d}</div>
              <div style="flex:1;height:8px;background:var(--border);border-radius:2px">
                <div style="height:100%;width:${barPct}%;background:${depthColor};border-radius:2px"></div>
              </div>
              <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:32px">${count}</div>
            </div>`);
        }
        html += `<div class="site-arch-panel">
          <div class="site-arch-panel-title">Click Depth</div>
          ${depthRows.join('')}
        </div>`;
      }

      // Directory Breakdown
      if (dirCounts && Object.keys(dirCounts).length > 0) {
        const sorted = Object.entries(dirCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const dirRows = sorted.map(([seg, count]) => {
          const barPct = Math.round(count / pageCount * 100);
          return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right">/${esc(seg)}</div>
            <div style="flex:1;height:8px;background:var(--border);border-radius:2px">
              <div style="height:100%;width:${barPct}%;background:var(--accent);border-radius:2px"></div>
            </div>
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:32px">${count}</div>
          </div>`;
        }).join('');
        html += `<div class="site-arch-panel">
          <div class="site-arch-panel-title">Directory Breakdown</div>
          ${dirRows}
        </div>`;
      }

      // Internal Link Equity
      if (linkEquity && linkEquity.length > 0) {
        const maxInbound = linkEquity[0]?.inbound || 1;
        const topLinked = linkEquity.slice(0, 8);
        const linkRows = topLinked.map(({ url: u, inbound }) => {
          const barPct = Math.round(inbound / maxInbound * 100);
          let display = u;
          try { display = new URL(u).pathname || '/'; } catch {}
          return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right" title="${esc(u)}">${esc(display)}</div>
            <div style="flex:1;height:8px;background:var(--border);border-radius:2px">
              <div style="height:100%;width:${barPct}%;background:var(--accent);border-radius:2px"></div>
            </div>
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:32px">${inbound}</div>
          </div>`;
        }).join('');
        html += `<div class="site-arch-panel">
          <div class="site-arch-panel-title">Most Linked Pages <span style="font-size:10px;color:var(--muted);font-weight:400">(inbound links)</span></div>
          ${linkRows}
        </div>`;
      }

      // Response Time panel
      if (responseStats && responseStats.avg !== null) {
        const avgMs  = responseStats.avg;
        const p95Ms  = responseStats.p95;
        const avgColor = avgMs >= 1800 ? 'var(--fail)' : avgMs >= 800 ? 'var(--warn)' : 'var(--pass)';
        const p95Color = p95Ms >= 1800 ? 'var(--fail)' : p95Ms >= 800 ? 'var(--warn)' : 'var(--pass)';
        const slowestRows = (responseStats.slowest || []).map(s => {
          const msColor = s.ms >= 1800 ? 'var(--fail)' : s.ms >= 800 ? 'var(--warn)' : 'var(--pass)';
          const shortUrl = s.url.replace(/^https?:\/\/[^/]+/, '') || '/';
          return `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:11px">
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)" title="${esc(s.url)}">${esc(shortUrl)}</span>
            <span style="font-family:'Space Mono',monospace;color:${msColor};white-space:nowrap">${s.ms}ms</span>
          </div>`;
        }).join('');
        html += `<div class="site-arch-panel">
          <div class="site-arch-panel-title">Response Time (TTFB)</div>
          <div style="display:flex;gap:24px;margin-bottom:8px">
            <div><div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${avgColor}">${avgMs}ms</div><div style="font-size:10px;color:var(--muted);margin-top:2px">avg</div></div>
            <div><div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${p95Color}">${p95Ms}ms</div><div style="font-size:10px;color:var(--muted);margin-top:2px">p95</div></div>
          </div>
          ${slowestRows ? `<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-top:10px;margin-bottom:4px">Slowest Pages</div>${slowestRows}` : ''}
        </div>`;
      }

      html += `</div>`;
    }

    // Internal Linking Opportunities
    if (linkOpportunities && linkOpportunities.length > 0) {
      html += `<div class="detail-label in" style="margin-top:32px">Internal Linking Opportunities</div>
        <div class="link-opps-wrap">
          <table class="link-opps-table">
            <thead><tr><th>From Page</th><th>To Page</th><th>Suggested Anchor</th></tr></thead>
            <tbody>
              ${linkOpportunities.map(op => {
                let fromPath = op.fromUrl, toPath = op.toUrl;
                try { fromPath = new URL(op.fromUrl).pathname || '/'; } catch {}
                try { toPath   = new URL(op.toUrl).pathname   || '/'; } catch {}
                return `<tr>
                  <td title="${esc(op.fromUrl)}">${esc(fromPath)}</td>
                  <td title="${esc(op.toUrl)}">${esc(toPath)}</td>
                  <td>${esc(op.suggestedAnchor)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }

    // Site Graph
    if (graphNodes && graphNodes.length > 0) {
      html += `<div class="detail-label in" style="margin-top:32px">
        Site Architecture Graph
        <button class="site-graph-toggle" onclick="toggleSiteGraph()" id="siteGraphToggle">Show Graph ▸</button>
      </div>
      <div id="siteGraphWrap" style="display:none">
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <button class="rec-btn" id="siteGraphResetBtn" onclick="resetGraphZoom()" style="font-size:11px">Reset Zoom</button>
        </div>
        <div id="siteGraphContainer" style="width:100%;height:480px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;overflow:hidden"></div>
        <div id="siteGraphTooltip" style="position:fixed;background:#111214;border:1px solid #1e2025;border-radius:4px;padding:6px 10px;font-size:11px;color:#e4e6ea;pointer-events:none;display:none;z-index:999;max-width:320px;word-break:break-all"></div>
      </div>`;
    }

    // Top Issues summary
    if (topIssues.length) {
      html += `<div class="detail-label" id="siteTopIssuesLabel">Top Issues</div><div class="result-rows" id="siteTopIssues">`;
      topIssues.forEach((r, i) => {
        const cat = resultCategory(r.name);
        const displayName = stripAuditPrefix(r.name);
        html += `
          <div class="result-row">
            <div class="row-status fail">${statusIcon('fail')}</div>
            <div>
              <div class="site-issue-name">${esc(displayName)}</div>
              <div class="site-issue-cat cat-${cat}">${CAT_LABELS[cat].short}</div>
              ${r.recommendation ? `
                <button class="rec-btn" onclick="toggleSiteRec('top${i}')">+ recommendation</button>
                <div class="row-rec" id="siteRectop${i}">${esc(r.recommendation)}</div>` : ''}
            </div>
            <div class="site-top-pct">${pct(r.fail.length)}%<div style="font-size:9px;color:var(--muted);font-weight:400;margin-top:2px">of pages</div></div>
          </div>`;
      });
      html += `</div>`;
    }

    // Issue Breakdown grouped by category
    const issueResults = sorted.filter(r => r.fail.length > 0 || r.warn.length > 0);
    if (issueResults.length) {
      html += `<div class="detail-label" id="siteBreakdownLabel" style="margin-top:32px">Issue Breakdown</div><div class="result-rows" id="siteBreakdown">`;
      let lastCat = null;
      issueResults.forEach((r, i) => {
        const cat = resultCategory(r.name);
        if (cat !== lastCat) {
          html += `<div class="detail-cat-header cat-${cat}">${CAT_LABELS[cat].short} <span class="cat-full">— ${CAT_LABELS[cat].full}</span></div>`;
          lastCat = cat;
        }
        const worstStatus = r.fail.length > 0 ? 'fail' : 'warn';
        const displayName = stripAuditPrefix(r.name);
        const totalAffected = r.fail.length + r.warn.length;
        const affectedUrls = [...r.fail.slice(0, 5), ...r.warn.slice(0, 5)];
        const moreCount = totalAffected - affectedUrls.length;
        const pctFail = pct(r.fail.length);
        const pctWarn = pct(r.warn.length);
        const pctPass = Math.max(0, 100 - pctFail - pctWarn);
        html += `
          <div class="result-row">
            <div class="row-status ${worstStatus}">${statusIcon(worstStatus)}</div>
            <div>
              <div class="site-issue-name">${esc(displayName)}</div>
              <div class="site-issue-cat cat-${cat}">${CAT_LABELS[cat].short}</div>
              ${r.recommendation ? `
                <button class="rec-btn" onclick="toggleSiteRec('issue${i}')">+ recommendation</button>
                <div class="row-rec" id="siteRecissue${i}">${esc(r.recommendation)}</div>` : ''}
              <button class="rec-btn" id="siteRowBtn${i}" data-total="${totalAffected}" onclick="toggleSiteRow(${i})">+ ${totalAffected} page${totalAffected !== 1 ? 's' : ''} affected</button>
              <div class="site-issue-urls" id="siteRow${i}">
                ${affectedUrls.map(u => `<div>${esc(u)}</div>`).join('')}
                ${moreCount > 0 ? `<div style="font-style:italic">…and ${moreCount} more</div>` : ''}
              </div>
            </div>
            <div class="site-issue-counts">
              ${r.fail.length > 0 ? `<span class="site-count-fail">${r.fail.length}/${pageCount} <span style="font-size:9px;font-weight:400">(${pct(r.fail.length)}%)</span></span>` : ''}
              ${r.warn.length > 0 ? `<span class="site-count-warn">${r.warn.length}/${pageCount} <span style="font-size:9px;font-weight:400">(${pct(r.warn.length)}%)</span></span>` : ''}
            </div>
            <div class="site-stacked-bar">
              <div class="site-stacked-seg" style="width:${pctFail}%;background:#ff4455"></div>
              <div class="site-stacked-seg" style="width:${pctWarn}%;background:#ffb800"></div>
              <div class="site-stacked-seg" style="width:${pctPass}%;background:#34d399"></div>
            </div>
          </div>`;
      });
      html += `</div>`;
    }

    // What's Working
    const passingChecks = sorted.filter(r => r.fail.length === 0 && r.warn.length === 0);
    if (passingChecks.length) {
      html += `<button class="site-working-toggle" onclick="toggleSiteWorking()">✓ What's Working (${passingChecks.length} checks)</button>
        <div class="site-working-rows" id="siteWorkingRows"><div class="result-rows in">`;
      let lastCat = null;
      passingChecks.forEach(r => {
        const cat = resultCategory(r.name);
        if (cat !== lastCat) {
          html += `<div class="detail-cat-header cat-${cat}">${CAT_LABELS[cat].short} <span class="cat-full">— ${CAT_LABELS[cat].full}</span></div>`;
          lastCat = cat;
        }
        const displayName = stripAuditPrefix(r.name);
        html += `
          <div class="result-row">
            <div class="row-status pass">${statusIcon('pass')}</div>
            <div>
              <div class="site-issue-name">${esc(displayName)}</div>
              <div class="site-issue-cat cat-${cat}">${CAT_LABELS[cat].short}</div>
            </div>
            <div class="site-issue-counts"><span class="site-count-pass">${r.pass.length}/${pageCount}</span></div>
            <div class="site-stacked-bar">
              <div class="site-stacked-seg" style="width:100%;background:#34d399"></div>
            </div>
          </div>`;
      });
      html += `</div></div>`;
    }

    html += `</div>`;
    document.getElementById('resultsInner').innerHTML = html;

    /* Trigger site audit animations after paint — hero all at once, then cascade */
    requestAnimationFrame(() => {
      setTimeout(() => animateScoreHero('site', siteScore), 100);
      setTimeout(() => { document.getElementById('siteStatsRow')?.classList.add('in'); }, 350);
      setTimeout(() => { document.getElementById('siteCatScoresRow')?.classList.add('in'); }, 500);
      setTimeout(() => {
        document.getElementById('siteExports')?.querySelectorAll('.pdf-link').forEach(el => el.classList.add('in'));
      }, 600);
      setTimeout(() => { document.getElementById('aiSummaryCard')?.classList.add('in'); }, 650);
      setTimeout(() => { document.querySelector('.site-arch-panels')?.classList.add('in'); }, 720);
      setTimeout(() => {
        document.getElementById('siteTopIssuesLabel')?.classList.add('in');
        document.getElementById('siteTopIssues')?.classList.add('in');
      }, 800);
      setTimeout(() => {
        document.getElementById('siteBreakdownLabel')?.classList.add('in');
        document.getElementById('siteBreakdown')?.classList.add('in');
      }, 900);
    });
  }

  function toggleSiteRow(i) {
    const el   = document.getElementById('siteRow' + i);
    const btn  = document.getElementById('siteRowBtn' + i);
    const open = el.style.display === 'block';
    el.style.display = open ? 'none' : 'block';
    if (btn) {
      const total = btn.dataset.total;
      const noun  = total !== '1' ? 'pages' : 'page';
      btn.textContent = open ? `+ ${total} ${noun} affected` : `− ${total} ${noun} affected`;
    }
  }

  function toggleSiteRec(id) {
    const el  = document.getElementById('siteRec' + id);
    const btn = el.previousElementSibling;
    const open = el.style.display === 'block';
    el.style.display = open ? 'none' : 'block';
    btn.textContent  = open ? '+ recommendation' : '− recommendation';
  }

  function toggleSiteWorking() {
    const el = document.getElementById('siteWorkingRows');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
  }

  /* ── Site Architecture Graph ── */
  let _d3ZoomBehavior = null;
  let _d3Svg = null;

  function toggleSiteGraph() {
    const wrap = document.getElementById('siteGraphWrap');
    const btn  = document.getElementById('siteGraphToggle');
    if (!wrap) return;
    const open = wrap.style.display !== 'none';
    wrap.style.display = open ? 'none' : 'block';
    if (btn) btn.textContent = open ? 'Show Graph ▸' : 'Hide Graph ▾';
    if (!open && window._lastGraphData) {
      // Render on first open
      buildSiteGraph(document.getElementById('siteGraphContainer'), window._lastGraphData);
    }
  }

  function resetGraphZoom() {
    if (_d3Svg && _d3ZoomBehavior) {
      _d3Svg.transition().duration(400).call(_d3ZoomBehavior.transform, window.d3.zoomIdentity);
    }
  }

  async function buildSiteGraph(container, { nodes, links }) {
    if (!container) return;
    container.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:12px">Loading graph…</div>';

    // Lazy-load D3
    if (!window.d3) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const d3 = window.d3;

    // Filter to nodes that appear in links
    const linkedIds = new Set(links.flatMap(l => [l.source, l.target]));
    const filteredNodes = nodes.filter(n => linkedIds.has(n.id) || nodes.length <= 20);
    const filteredLinks = links.filter(l =>
      filteredNodes.some(n => n.id === l.source) && filteredNodes.some(n => n.id === l.target)
    );

    container.innerHTML = '';
    const W = container.clientWidth || 600;
    const H = container.clientHeight || 480;

    const svg = d3.select(container).append('svg')
      .attr('width', W).attr('height', H);

    const g = svg.append('g');

    const zoom = d3.zoom().scaleExtent([0.1, 4]).on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(zoom);
    _d3ZoomBehavior = zoom;
    _d3Svg = svg;

    // Build link simulation data (use string IDs, D3 will resolve)
    const simLinks = filteredLinks.map(l => ({ source: l.source, target: l.target }));
    const simNodes = filteredNodes.map(n => ({ ...n }));

    const maxInbound = Math.max(1, ...simNodes.map(n => n.inbound));

    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(18));

    const link = g.append('g').selectAll('line')
      .data(simLinks).join('line')
      .attr('stroke', '#2a2d35').attr('stroke-width', 1).attr('stroke-opacity', 0.6);

    const node = g.append('g').selectAll('circle')
      .data(simNodes).join('circle')
      .attr('r', d => 5 + Math.round((d.inbound / maxInbound) * 8))
      .attr('fill', d => d.fails > 3 ? '#ff4455' : d.fails > 0 ? '#ffb800' : '#34d399')
      .attr('stroke', '#0b0c0e').attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on('mouseover', (e, d) => {
        const tip = document.getElementById('siteGraphTooltip');
        if (tip) { tip.style.display = 'block'; tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 8) + 'px'; tip.textContent = d.id; }
      })
      .on('mousemove', (e) => {
        const tip = document.getElementById('siteGraphTooltip');
        if (tip) { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 8) + 'px'; }
      })
      .on('mouseout', () => {
        const tip = document.getElementById('siteGraphTooltip');
        if (tip) tip.style.display = 'none';
      })
      .on('click', (e, d) => {
        const neighbors = new Set(simLinks.filter(l =>
          l.source.id === d.id || l.target.id === d.id
        ).flatMap(l => [l.source.id, l.target.id]));
        node.attr('opacity', n => neighbors.has(n.id) ? 1 : 0.2);
        link.attr('opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1);
        e.stopPropagation();
      });

    svg.on('click', () => {
      node.attr('opacity', 1);
      link.attr('opacity', 0.6);
    });

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('cx', d => d.x).attr('cy', d => d.y);
    });
  }

  function toggleRec(i) {
    const el  = document.getElementById('rec' + i);
    const btn = el.previousElementSibling;
    const open = el.style.display === 'block';
    el.style.display = open ? 'none' : 'block';
    btn.textContent  = open ? '+ recommendation' : '− recommendation';
  }

  function toggleDetail(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    const open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    btn.textContent = open ? '+ ' + btn.dataset.count + ' more' : '− show less';
  }

  /* ── Auth widget ── */
  let _currentUser  = null;
  let _multiLimit   = 3;   // default until /api/me responds

  async function initAuthWidget() {
    try {
      const res = await fetch('/api/me');
      const { user, limits } = await res.json();
      _currentUser = user;
      window._sgPlan = user?.plan ?? 'free';

      // Update limit notes and enforce tier caps in the UI
      if (limits) {
        const planLabel = user ? (user.plan === 'pro' ? 'PRO' : user.plan === 'agency' ? 'AGENCY' : 'FREE') : 'FREE';

        const crawlNote = document.getElementById('crawlLimitNote');
        if (crawlNote) crawlNote.innerHTML = `Up to ${limits.crawlPageLimit} pages per crawl<span class="tier-badge">${planLabel}</span>`;

        _multiLimit = limits.multiAuditLimit;
        const multiNote = document.querySelector('.multi-limit-note');
        if (multiNote) multiNote.innerHTML = `Up to ${_multiLimit} location${_multiLimit !== 1 ? 's' : ''}<span class="tier-badge" style="margin-left:8px">${planLabel}</span>`;

        // Remove excess rows if user added more than their limit before auth loaded
        const wrap = document.getElementById('multiLocRows');
        if (wrap) {
          const rows = wrap.querySelectorAll('.multi-loc-row');
          for (let i = rows.length - 1; i >= _multiLimit; i--) rows[i].remove();
        }
      }

      // Enable JS Render toggle for pro/agency users
      const jsToggle = document.getElementById('jsRenderToggle');
      const jsLabel  = document.getElementById('jsRenderLabel');
      if (jsToggle) {
        const isPro = user && (user.plan === 'pro' || user.plan === 'agency');
        jsToggle.disabled = !isPro;
        if (jsLabel) jsLabel.style.opacity = isPro ? '1' : '0.45';
      }

      const widget = document.getElementById('authWidget');
      if (!widget) return;
      if (user) {
        widget.innerHTML =
          `<div class="auth-user">` +
          (user.avatar_url ? `<img class="auth-avatar" src="${esc(user.avatar_url)}" referrerpolicy="no-referrer" alt="" />` : '') +
          `<a href="/dashboard" class="auth-link">Dashboard</a>` +
          `<a href="/account" class="auth-link">Account</a>` +
          `<a href="/auth/logout" class="auth-signout">Sign out</a>` +
          `</div>`;
      } else {
        widget.innerHTML = `<a href="/auth/google" class="google-btn">Sign in</a>`;
      }
    } catch (_) {}
  }

  function buildGscPanelHtml(gsc) {
    if (!gsc.connected) {
      return `<div class="gsc-panel">
        <div class="gsc-panel-title">Search Console Data</div>
        <div class="gsc-panel-empty">
          This site isn't connected to Google Search Console, or you haven't granted access yet.
          <a class="gsc-connect-link" href="https://search.google.com/search-console" target="_blank" rel="noopener">Open Search Console →</a>
        </div>
      </div>`;
    }

    let siteLabel = gsc.site || '';
    try {
      if (!siteLabel.startsWith('sc-domain:')) siteLabel = new URL(gsc.site).hostname;
    } catch (_) {}

    if (!gsc.rows || !gsc.rows.length) {
      return `<div class="gsc-panel">
        <div class="gsc-panel-title">Search Console Data</div>
        <div class="gsc-panel-period">Last 28 days · ${esc(siteLabel)}</div>
        <div class="gsc-panel-empty">No query data found for this property in the last 28 days.</div>
      </div>`;
    }

    const rows = gsc.rows.map(r => {
      const query      = (r.keys && r.keys[0]) || '';
      const clicks     = (r.clicks     ?? 0).toLocaleString();
      const impressions= (r.impressions ?? 0).toLocaleString();
      const position   = r.ctr !== undefined ? (r.position ?? 0).toFixed(1) : (r.position ?? 0).toFixed(1);
      return `<tr>
        <td>${esc(query)}</td>
        <td class="gsc-td-num">${clicks}</td>
        <td class="gsc-td-num">${impressions}</td>
        <td class="gsc-td-num">${position}</td>
      </tr>`;
    }).join('');

    return `<div class="gsc-panel">
      <div class="gsc-panel-title">Search Console Data</div>
      <div class="gsc-panel-period">Last 28 days · Top 10 queries · ${esc(siteLabel)}</div>
      <table class="gsc-table">
        <thead><tr>
          <th>Query</th>
          <th class="gsc-td-num">Clicks</th>
          <th class="gsc-td-num">Impressions</th>
          <th class="gsc-td-num">Position</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function buildGa4PanelHtml(ga4) {
    if (!ga4.connected) {
      return `<div class="gsc-panel">
        <div class="gsc-panel-title">Google Analytics 4</div>
        <div class="gsc-panel-empty">
          No GA4 property found for this domain, or analytics access hasn't been granted.
          <a class="gsc-connect-link" href="/auth/google" rel="noopener">Reconnect Google account →</a>
        </div>
      </div>`;
    }

    if (!ga4.rows || !ga4.rows.length) {
      return `<div class="gsc-panel">
        <div class="gsc-panel-title">Google Analytics 4</div>
        <div class="gsc-panel-period">Last 28 days · Property ${esc(ga4.propertyId || '')}</div>
        <div class="gsc-panel-empty">No session data found for this property in the last 28 days.</div>
      </div>`;
    }

    const rows = ga4.rows.map(r => {
      const pct = (r.engagementRate * 100).toFixed(1) + '%';
      return `<tr>
        <td>${esc(r.channel)}</td>
        <td class="gsc-td-num">${r.sessions.toLocaleString()}</td>
        <td class="gsc-td-num">${pct}</td>
      </tr>`;
    }).join('');

    return `<div class="gsc-panel">
      <div class="gsc-panel-title">Google Analytics 4</div>
      <div class="gsc-panel-period">Last 28 days · By channel · Property ${esc(ga4.propertyId || '')}</div>
      <table class="gsc-table">
        <thead><tr>
          <th>Channel</th>
          <th class="gsc-td-num">Sessions</th>
          <th class="gsc-td-num">Engagement Rate</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  async function loadGa4Panel(url) {
    if (!_currentUser) return;
    const inner = document.getElementById('resultsInner');
    if (!inner) return;
    try {
      const ga4 = await fetch(`/api/ga4-data?url=${encodeURIComponent(url)}`).then(r => r.json());
      const div = document.createElement('div');
      div.innerHTML = buildGa4PanelHtml(ga4);
      inner.appendChild(div.firstElementChild);
    } catch (_) {}
  }

  async function loadGscPanel(url) {
    if (!_currentUser) return;
    const inner = document.getElementById('resultsInner');
    if (!inner) return;
    try {
      const gsc = await fetch(`/api/gsc-data?url=${encodeURIComponent(url)}`).then(r => r.json());
      const div = document.createElement('div');
      div.innerHTML = buildGscPanelHtml(gsc);
      inner.appendChild(div.firstElementChild);
    } catch (_) {}
  }

  function buildRobotsTesterPanel(url) {
    return `<div class="robots-tester-panel">
      <div class="gsc-panel-title">Robots.txt Crawler Access</div>
      <div class="robots-tester-input-row">
        <input type="url" id="robotsTestUrl" class="robots-test-url-input" value="${esc(url)}" spellcheck="false" autocomplete="off" />
        <button class="rec-btn generate-btn" id="robotsTestBtn" onclick="testRobotsAccess(this)">Test</button>
      </div>
      <div id="robotsTestResult"></div>
    </div>`;
  }

  async function testRobotsAccess(btn) {
    const urlInput = document.getElementById('robotsTestUrl');
    const resultEl = document.getElementById('robotsTestResult');
    if (!urlInput || !resultEl) return;
    const url = urlInput.value.trim();
    if (!url) return;
    btn.disabled = true;
    btn.textContent = 'Testing…';
    resultEl.innerHTML = '';
    try {
      const res  = await fetch('/api/robots-test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        resultEl.innerHTML = `<div class="robots-test-error">${esc(data.message || 'Request failed.')}</div>`;
        return;
      }
      const statusLine = data.found
        ? `<div class="robots-test-meta">Found: <a href="${esc(data.robotsUrl)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(data.robotsUrl)}</a></div>`
        : `<div class="robots-test-meta" style="color:var(--warn)">No robots.txt found — all crawlers allowed by default.</div>`;
      const rows = Object.entries(data.crawlers).map(([name, status]) => {
        const isAllowed = status === 'allowed';
        return `<tr>
          <td class="robots-td-name">${esc(name)}</td>
          <td class="robots-td-status ${isAllowed ? 'robots-allowed' : 'robots-blocked'}">
            ${isAllowed ? '✓ Allowed' : '✗ Blocked'}
          </td>
        </tr>`;
      }).join('');
      resultEl.innerHTML = `${statusLine}
        <table class="gsc-table robots-results-table">
          <thead><tr><th>Crawler</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    } catch (_) {
      resultEl.innerHTML = `<div class="robots-test-error">Could not reach server.</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test';
    }
  }

  async function appendRobotsPanel(url) {
    const inner = document.getElementById('resultsInner');
    if (!inner) return;
    const div = document.createElement('div');
    div.innerHTML = buildRobotsTesterPanel(url);
    inner.appendChild(div.firstElementChild);
  }

  function showSavedNote() {
    if (!_currentUser) return;
    const inner = document.getElementById('resultsInner');
    if (!inner) return;
    const note = document.createElement('div');
    note.className = 'saved-note';
    note.textContent = '✓ Saved to your history';
    inner.appendChild(note);
  }

  function _sgInit() {
    initAuthWidget();

    // Replay mode: render a saved report without running an audit
    if (window._sgReplayData) {
      const d = window._sgReplayData;
      window._sgReplayData = null; // clear so normal audit UI works on back-navigation
      const inner = document.getElementById('resultsInner');
      if (inner) inner.innerHTML = ''; // clear loading state
      if (d._replayType === 'site') {
        renderSiteResults({ pageCount: d.pageCount, results: d.results, siteUrl: d.url, pdfFile: d.pdfFile, depthDistribution: d.depthDistribution, dirCounts: d.dirCounts, linkEquity: d.linkEquity, responseStats: d.responseStats, aiSummary: d.aiSummary, linkOpportunities: d.linkOpportunities, graphNodes: d.graphNodes, graphLinks: d.graphLinks });
      } else {
        renderResults(d);
        loadGscPanel(d.url || '');
        loadGa4Panel(d.url || '');
        appendRobotsPanel(d.url || '');
      }
      // Show replay banner
      const resultsInner = document.getElementById('resultsInner');
      if (resultsInner) {
        const banner = document.createElement('div');
        banner.style.cssText = 'font-family:"Space Mono",monospace;font-size:10px;color:var(--muted);text-align:center;padding:12px 0 0;letter-spacing:0.06em;';
        const date = d.auditedAt ? new Date(d.auditedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        banner.textContent = `Saved report${date ? ' · ' + date : ''}`;
        resultsInner.appendChild(banner);
      }
      return;
    }

    const urlInput = document.getElementById('urlInput');
    if (urlInput) urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') runAudit(); });
    const auditBtn = document.getElementById('auditBtn');
    if (auditBtn) auditBtn.addEventListener('click', runAudit);
    const multiAuditBtn = document.getElementById('multiAuditBtn');
    if (multiAuditBtn) multiAuditBtn.addEventListener('click', runMultiAudit);
    if (!document.querySelectorAll('.multi-loc-row').length) addMultiRow();
  }

  window._sgOnMount = _sgInit;
  _sgInit();
