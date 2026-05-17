/* ── AI cache ── */
  let _currentReportId = null;
  let _aiRecsCache = {};  // checkName → recommendation text
  let _currentSiteReportId = null;
  let _aiSiteRecsCache = {};

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
    const csRow = document.getElementById('crawlSettingsRow');
    if (csRow) csRow.style.display = mode === 'site' ? 'block' : 'none';
    const ccEl = document.getElementById('checkCount');
    if (ccEl) ccEl.textContent = mode === 'site' ? '90+' : mode === 'bulk' ? '83' : STATIC_CHECK_COUNT;
  }

  /* ── Crawl Settings panel ── */
  function toggleCrawlSettings() {
    const panel = document.getElementById('crawlSettingsPanel');
    const btn   = document.getElementById('crawlSettingsToggle');
    if (!panel) return;
    const open = panel.style.display === 'block';
    panel.style.display = open ? 'none' : 'block';
    if (btn) btn.textContent = open ? '⚙ Crawl Settings' : '⚙ Crawl Settings ▾';
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
  // Static check count shown before any audit starts; updated from SSE once audit begins
  // 100 modules load; checkPageSpeed returns up to 4 checks → "100+" for page/compare
  const STATIC_CHECK_COUNT = '100+';
  const _cc = document.getElementById('checkCount');
  if (_cc) _cc.textContent = STATIC_CHECK_COUNT;

  function showProgressUI() {
    document.getElementById('statusLine').style.display = 'flex';
    document.getElementById('progressTrack').style.display = 'block';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('statusText').textContent = 'Starting audit...';
  }

  function stopSteps() {
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
  let _latestBulkAiTriage = null;
  let _bulkSortCol = null;
  let _bulkSortDir = -1;

  function _sortBulkResults(arr) {
    if (!_bulkSortCol) return arr;
    return arr.slice().sort((a, b) => {
      // errors always sink to the bottom
      if (a.error && !b.error) return 1;
      if (!a.error && b.error) return -1;
      if (_bulkSortCol === 'url') {
        return _bulkSortDir * (a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
      }
      const key = _bulkSortCol === 'fails' ? 'failCount' : 'score';
      return _bulkSortDir * ((b[key] ?? -1) - (a[key] ?? -1));
    });
  }

  function _buildBulkRows(results) {
    return results.map(r => {
      if (r.error) {
        return `<tr class="bulk-row" data-url="${esc(r.url)}" data-grade="">
          <td colspan="6" style="padding:10px 12px;border-bottom:1px solid var(--border)">
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text);word-break:break-all">${esc(r.url)}</div>
            <div style="font-size:11px;color:var(--fail);margin-top:3px">${esc(r.error)}</div>
          </td>
        </tr>`;
      }
      const gColor = gradeColor(r.score);
      const issues = r.topIssues.map(i => `<span style="font-size:10px;color:var(--fail);display:block;margin-bottom:2px">${esc(i)}</span>`).join('');
      const catPills = r.catScores ? `<div style="display:flex;gap:10px;margin-top:5px;flex-wrap:wrap;align-items:center">
        <span style="font-family:'Space Mono',monospace;font-size:10px;color:#8892a4">T&nbsp;${r.catScores.technical}</span>
        <span style="font-family:'Space Mono',monospace;font-size:10px;color:#e8a87c">C&nbsp;${r.catScores.content}</span>
        <span style="font-family:'Space Mono',monospace;font-size:10px;color:#7baeff">A&nbsp;${r.catScores.aeo}</span>
        <span style="font-family:'Space Mono',monospace;font-size:10px;color:#b07bff">G&nbsp;${r.catScores.geo}</span>
      </div>` : '';
      const viewLink = r.reportId ? `<a href="/report/${r.reportId}" target="_blank" class="bulk-act-link">View&nbsp;→</a>` : '';
      const reauditBtn = `<button class="bulk-reaudit-btn" onclick="window._bulkReaudit(this,'${esc(r.url).replace(/'/g,"\\'")}')">↻&nbsp;Re-audit</button>`;
      return `<tr class="bulk-row" data-url="${esc(r.url)}" data-grade="${r.grade || ''}">
        <td style="padding:10px 12px;border-bottom:1px solid var(--border);overflow:hidden">
          <div class="bulk-row-url" style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.url)}</div>
          ${catPills}
        </td>
        <td class="bulk-row-grade" style="padding:10px 12px;border-bottom:1px solid var(--border);text-align:center"><span class="report-grade" style="color:${gColor}">${r.grade}</span></td>
        <td class="bulk-row-score" style="padding:10px 12px;border-bottom:1px solid var(--border);text-align:center"><span class="report-score">${r.score}/100</span></td>
        <td class="bulk-row-checks" style="padding:10px 12px;border-bottom:1px solid var(--border);text-align:center;font-family:'Space Mono',monospace;font-size:12px;white-space:nowrap"><span style="color:var(--fail)">${r.failCount}✕</span> <span style="color:var(--warn)">${r.warnCount}△</span> <span style="color:var(--pass)">${r.passCount}✓</span></td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border)">${issues || '<span style="font-size:11px;color:var(--muted)">—</span>'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border);white-space:nowrap">${viewLink}${reauditBtn}</td>
      </tr>`;
    }).join('');
  }

  window.applyBulkFilter = function() {
    const urlQ = (document.getElementById('bulkFilterUrl')?.value || '').toLowerCase();
    const gradeQ = document.querySelector('.bulk-grade-chip.active')?.dataset.grade || 'all';
    const statusQ = document.querySelector('.bulk-status-chip.active')?.dataset.status || 'all';
    document.querySelectorAll('#bulkTable .bulk-row').forEach(row => {
      const url   = (row.dataset.url   || '').toLowerCase();
      const grade = (row.dataset.grade || '').toUpperCase();
      let show = true;
      if (urlQ && !url.includes(urlQ)) show = false;
      if (gradeQ !== 'all' && grade !== gradeQ) show = false;
      if (statusQ === 'fails' && !['D','F'].includes(grade)) show = false;
      if (statusQ === 'pass'  && !['A','B'].includes(grade)) show = false;
      row.style.display = show ? '' : 'none';
    });
  };

  window._bulkReaudit = async function(btn, url) {
    btn.disabled = true;
    btn.textContent = 'Auditing…';
    btn.classList.add('auditing');
    const row = btn.closest('.bulk-row');
    try {
      const res = await fetch('/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const msg = JSON.parse(line.slice(5).trim());
            if (msg.type === 'done') {
              const gColor = gradeColor(msg.totalScore);
              const gradeCell = row.querySelector('.bulk-row-grade');
              const scoreCell = row.querySelector('.bulk-row-score');
              const checksCell = row.querySelector('.bulk-row-checks');
              if (gradeCell) { const s = gradeCell.querySelector('.report-grade'); if (s) { s.textContent = msg.grade; s.style.color = gColor; } }
              if (scoreCell) { const s = scoreCell.querySelector('.report-score'); if (s) s.textContent = `${msg.totalScore}/100`; }
              if (checksCell) {
                const fail = (msg.results || []).filter(r => r.status === 'fail').length;
                const warn = (msg.results || []).filter(r => r.status === 'warn').length;
                const pass = (msg.results || []).filter(r => r.status === 'pass').length;
                checksCell.innerHTML = `<span style="color:var(--fail)">${fail}✕</span> <span style="color:var(--warn)">${warn}△</span> <span style="color:var(--pass)">${pass}✓</span>`;
              }
              row.dataset.grade = msg.grade || '';
              if (msg.reportId) {
                const viewLink = row.querySelector('.bulk-act-link');
                if (viewLink) viewLink.href = `/report/${msg.reportId}`;
              }
            }
          } catch {}
        }
      }
    } catch {}
    btn.classList.remove('auditing');
    btn.classList.add('done');
    btn.textContent = '✓\u00a0Done';
    setTimeout(() => {
      btn.classList.remove('done');
      btn.textContent = '↻\u00a0Re-audit';
      btn.disabled = false;
    }, 1500);
  };

  window._bulkSortBy = function(col) {
    _bulkSortDir = (_bulkSortCol === col) ? -_bulkSortDir : -1;
    _bulkSortCol = col;
    const tableBody = document.querySelector('#bulkTable tbody');
    if (tableBody) tableBody.innerHTML = _buildBulkRows(_sortBulkResults(_latestBulkResults));
    document.querySelectorAll('#bulkTable [data-sort]').forEach(th => {
      const active = th.dataset.sort === _bulkSortCol;
      th.style.color = active ? 'var(--text)' : '';
      const arr = th.querySelector('.bulk-arr');
      if (arr) arr.textContent = active ? (_bulkSortDir === -1 ? ' ↓' : ' ↑') : ' ↕';
    });
  };

  async function runBulkAudit() {
    const textarea = document.getElementById('bulkUrlInput');
    if (!textarea) return;
    const urlLines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    if (!urlLines.length) { showError('Enter at least one URL.'); return; }

    clearError();
    const btn = document.getElementById('bulkAuditBtn');
    if (btn) btn.disabled = true;
    const resultsEl = document.getElementById('results');
    resultsEl.style.display = 'none';
    resultsEl.classList.remove('visible');
    showProgressUI();
    const statusText   = document.getElementById('statusText');
    const progressFill = document.getElementById('progressFill');
    if (statusText) statusText.textContent = `Starting bulk audit on ${urlLines.length} URL${urlLines.length !== 1 ? 's' : ''}…`;

    try {
      const res = await fetch('/bulk-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlLines }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        stopSteps();
        showError(errData.message || 'Bulk audit failed.');
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      const allResults = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const sseLines = buf.split('\n');
        buf = sseLines.pop();
        for (const line of sseLines) {
          if (!line.startsWith('data: ')) continue;
          let evt;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === 'progress') {
            if (statusText) statusText.textContent = `(${evt.current}/${evt.total}) Auditing: ${evt.url}…`;
            if (progressFill) progressFill.style.width = Math.round(((evt.current - 1) / evt.total) * 100) + '%';
          } else if (evt.type === 'result') {
            allResults.push(evt);
            if (progressFill) progressFill.style.width = Math.round((allResults.length / urlLines.length) * 90) + '%';
          } else if (evt.type === 'done') {
            if (progressFill) progressFill.style.width = '100%';
            if (statusText) statusText.textContent = 'Done.';
            await new Promise(r => setTimeout(r, 600));
            stopSteps();
            const sl = document.getElementById('statusLine');
            const pt = document.getElementById('progressTrack');
            if (sl) sl.style.display = 'none';
            if (pt) pt.style.display = 'none';
            _latestBulkResults = allResults;
            renderBulkResults(allResults, evt.aiTriage ?? null);
            resultsEl.style.display = 'block';
            requestAnimationFrame(() => {
              resultsEl.scrollIntoView({ behavior: 'smooth' });
              requestAnimationFrame(() => resultsEl.classList.add('visible'));
            });
          }
        }
      }
    } catch {
      stopSteps();
      const sl = document.getElementById('statusLine');
      const pt = document.getElementById('progressTrack');
      if (sl) sl.style.display = 'none';
      if (pt) pt.style.display = 'none';
      showError('Could not connect to the server.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function _renderBulkTriage(triage) {
    if (!triage) return '';
    const critRows = (triage.criticalUrls || []).map(c =>
      `<div class="bulk-crit-row">
        <span class="bulk-crit-url">${esc(c.url || '')}</span>
        <span class="bulk-crit-reason">${esc(c.reason || '')}</span>
      </div>`
    ).join('');
    const qwUrl = triage.quickWin?.url ? `<span class="bulk-qw-url"> — ${esc(triage.quickWin.url)}</span>` : '';
    return `<div class="bulk-triage-card">
      <div class="bulk-triage-label">AI Triage Summary</div>
      ${triage.headline ? `<div class="bulk-triage-headline">${esc(triage.headline)}</div>` : ''}
      ${critRows ? `<div class="bulk-triage-critical">
        <div class="bulk-triage-section-label">Critical URLs</div>
        ${critRows}
      </div>` : ''}
      <div class="bulk-triage-bottom">
        ${triage.commonIssue ? `<div class="bulk-common-issue">
          <span class="bulk-triage-section-label">Common Issue</span>
          <span class="bulk-common-text">${esc(triage.commonIssue)}</span>
        </div>` : ''}
        ${triage.quickWin?.action ? `<div class="bulk-quick-win">
          <span class="exec-qw-label">Quick Win</span>
          <span class="exec-qw-text">${esc(triage.quickWin.action)}${qwUrl}</span>
        </div>` : ''}
      </div>
    </div>`;
  }

  function renderBulkResults(results, aiTriage) {
    _latestBulkResults = results;
    _latestBulkAiTriage = aiTriage;
    _bulkSortCol = null;

    // Aggregate stats across all URLs
    const validResults = results.filter(r => !r.error && r.score != null);
    const avgScore = validResults.length ? Math.round(validResults.reduce((s, r) => s + r.score, 0) / validResults.length) : 0;
    const avgGrade = letterGrade(avgScore);
    const avgColor = gradeColor(avgScore);
    const totalFail = validResults.reduce((s, r) => s + (r.failCount || 0), 0);
    const totalWarn = validResults.reduce((s, r) => s + (r.warnCount || 0), 0);
    const totalPass = validResults.reduce((s, r) => s + (r.passCount || 0), 0);

    // Avg category scores across all valid results
    const avgCat = {
      technical: validResults.length ? Math.round(validResults.reduce((s, r) => s + (r.catScores?.technical ?? 0), 0) / validResults.length) : 0,
      content:   validResults.length ? Math.round(validResults.reduce((s, r) => s + (r.catScores?.content   ?? 0), 0) / validResults.length) : 0,
      aeo:       validResults.length ? Math.round(validResults.reduce((s, r) => s + (r.catScores?.aeo       ?? 0), 0) / validResults.length) : 0,
      geo:       validResults.length ? Math.round(validResults.reduce((s, r) => s + (r.catScores?.geo       ?? 0), 0) / validResults.length) : 0,
    };
    const savedCount = validResults.filter(r => r.reportId).length;
    const savedNote = savedCount > 0 ? `<div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);text-align:center;margin-bottom:16px">${savedCount} report${savedCount !== 1 ? 's' : ''} saved to dashboard</div>` : '';

    const csv = [['URL','Grade','Score','Fails','Warns','Passes','Technical','Content','AEO','GEO','Top Issues'],
      ...results.map(r => [r.url, r.grade || '', r.score ?? '', r.failCount ?? '', r.warnCount ?? '', r.passCount ?? '',
        r.catScores?.technical ?? '', r.catScores?.content ?? '', r.catScores?.aeo ?? '', r.catScores?.geo ?? '',
        (r.topIssues || []).join('; ')])
        .map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    ].join('\n');

    const thStyle = 'padding:8px 12px;font-family:\'Space Mono\',monospace;font-size:10px;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;user-select:none;transition:color 0.15s';
    const thStyleCenter = thStyle + ';text-align:center';

    const urlCount = `${results.length} URL${results.length !== 1 ? 's' : ''}`;
    document.getElementById('resultsInner').innerHTML = `
      <div class="site-results-wrap">
        ${buildScoreHero({
          grade: avgGrade, score: avgScore, color: avgColor,
          pass: totalPass, warn: totalWarn, fail: totalFail,
          catScores: avgCat, idPrefix: 'bulk',
          auditLabel: 'Bulk Audit', auditUrl: urlCount,
          subtitle: `Avg Score · ${urlCount}`
        })}

        <div id="bulkExports" style="display:flex;gap:12px;justify-content:center;margin-bottom:16px">
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

        ${savedNote}

        ${_renderBulkTriage(aiTriage)}

        <div class="filter-bar">
          <input id="bulkFilterUrl" class="filter-search" type="text" placeholder="Filter by URL…"
            oninput="window.applyBulkFilter()" style="width:180px"/>
          <div class="filter-group">
            ${['all','A','B','C','D','F'].map(g => `<button class="filter-chip bulk-grade-chip${g==='all'?' active':''}" data-grade="${g}" onclick="document.querySelectorAll('.bulk-grade-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active');window.applyBulkFilter()">${g==='all'?'All Grades':g}</button>`).join('')}
          </div>
          <div class="filter-group">
            ${[['all','All'],['fails','Fails'],['pass','Pass']].map(([v,l]) => `<button class="filter-chip bulk-status-chip${v==='all'?' active':''}" data-status="${v}" onclick="document.querySelectorAll('.bulk-status-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active');window.applyBulkFilter()">${l}</button>`).join('')}
          </div>
        </div>

        <div class="bulk-table-wrap" id="bulkTable" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:640px">
            <colgroup>
              <col style="width:32%"/>
              <col style="width:8%"/>
              <col style="width:10%"/>
              <col style="width:12%"/>
              <col style="width:26%"/>
              <col style="width:12%"/>
            </colgroup>
            <thead>
              <tr style="border-bottom:2px solid var(--border)">
                <th data-sort="url" onclick="_bulkSortBy('url')" style="${thStyle};text-align:left">URL<span class="bulk-arr"> ↕</span></th>
                <th data-sort="score" onclick="_bulkSortBy('score')" style="${thStyleCenter}">Grade<span class="bulk-arr"> ↕</span></th>
                <th data-sort="score" onclick="_bulkSortBy('score')" style="${thStyleCenter}">Score<span class="bulk-arr"> ↕</span></th>
                <th data-sort="fails" onclick="_bulkSortBy('fails')" style="${thStyleCenter}">Checks<span class="bulk-arr"> ↕</span></th>
                <th style="${thStyle};text-align:left;cursor:default">Top Issues</th>
                <th style="${thStyle};text-align:left;cursor:default">Actions</th>
              </tr>
            </thead>
            <tbody>${_buildBulkRows(results)}</tbody>
          </table>
        </div>
      </div>`;

    /* Trigger bulk animations — matches page/site stagger */
    requestAnimationFrame(() => {
      setTimeout(() => animateScoreHero('bulk', avgScore), 100);
      setTimeout(() => { document.getElementById('bulkStatsRow')?.classList.add('in'); }, 350);
      setTimeout(() => { document.getElementById('bulkCatScoresRow')?.classList.add('in'); }, 500);
      setTimeout(() => { document.getElementById('bulkExports')?.querySelectorAll('.pdf-link').forEach(el => el.classList.add('in')); }, 600);
      setTimeout(() => { document.getElementById('bulkTable')?.classList.add('in'); }, 700);
    });
  }

  /* ── AI Executive Summary renderer ── */
  function _renderExecSummaryCard(aiSummaryStr, cardId) {
    let parsed = null
    if (aiSummaryStr && typeof aiSummaryStr === 'string' && aiSummaryStr.trim().startsWith('{')) {
      try { parsed = JSON.parse(aiSummaryStr) } catch {}
    }
    if (parsed) {
      const areaClass = (a) => {
        if (!a) return 'exec-area-technical'
        const lower = String(a).toLowerCase()
        if (lower === 'content') return 'exec-area-content'
        if (lower === 'aeo') return 'exec-area-aeo'
        if (lower === 'geo') return 'exec-area-geo'
        return 'exec-area-technical'
      }
      const impactClass = (i) => {
        if (i === 'high') return 'exec-impact-high'
        if (i === 'medium') return 'exec-impact-medium'
        return 'exec-impact-low'
      }
      const issues = (parsed.issues || []).slice(0, 3)
      const issueRows = issues.map(issue =>
        `<div class="exec-issue-row">
          <span class="exec-issue-area ${areaClass(issue.area)}">${esc(issue.area || 'Technical')}</span>
          <span class="exec-issue-finding">${esc(issue.finding || '')}</span>
          <span class="exec-impact ${impactClass(issue.impact)}">${esc(issue.impact || 'low')}</span>
          ${issue.pagesAffected ? `<span style="font-size:10px;color:var(--muted)">${issue.pagesAffected} pages</span>` : ''}
        </div>`
      ).join('')
      return `<div class="ai-summary-card" id="${cardId}">
        <div class="ai-summary-label">AI Executive Summary</div>
        ${parsed.verdict ? `<div class="exec-verdict">${esc(parsed.verdict)}</div>` : ''}
        ${issues.length ? `<div class="exec-issues">${issueRows}</div>` : ''}
        ${parsed.quickWin ? `<div class="exec-quick-win"><span class="exec-qw-label">Quick Win</span><span class="exec-qw-text">${esc(parsed.quickWin)}</span></div>` : ''}
      </div>`
    }
    // Legacy plain text
    return `<div class="ai-summary-card" id="${cardId}">
      <div class="ai-summary-label">AI Executive Summary</div>
      <div class="ai-summary-text">${esc(aiSummaryStr)}</div>
    </div>`
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

    if (recommendation && typeof recommendation === 'object' && recommendation.fix) {
      // Structured format
      const effortClass = recommendation.effort === 'high' ? 'fix-effort-high' : recommendation.effort === 'medium' ? 'fix-effort-medium' : 'fix-effort-low';
      const stepsHtml = (recommendation.steps || []).map(s => `<li class="fix-step">${esc(s)}</li>`).join('');
      const fixText = esc(recommendation.fix || '');
      suggestEl.className = 'meta-suggestion ai-fix-suggestion ai-fix-structured';
      suggestEl.innerHTML = `
        <div class="fix-main-row">
          <span class="fix-text">${fixText}</span>
          ${recommendation.effort ? `<span class="fix-effort ${effortClass}">${esc(recommendation.effort)} effort</span>` : ''}
        </div>
        ${recommendation.why ? `<div class="fix-why">${esc(recommendation.why)}</div>` : ''}
        ${stepsHtml ? `<ol class="fix-steps">${stepsHtml}</ol>` : ''}
        <div class="fix-actions">
          <button class="rec-btn" data-copy="${fixText}" onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy Fix'},1500)})">Copy Fix</button>
        </div>`;
    } else {
      // Legacy plain text
      const text = esc(typeof recommendation === 'string' ? recommendation : String(recommendation));
      suggestEl.className = 'meta-suggestion ai-fix-suggestion';
      suggestEl.innerHTML = `<span class="meta-suggestion-text">${text}</span> <button class="rec-btn" data-copy="${text}" onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500)})">Copy</button>`;
    }

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

  /* ── Site Audit AI Fix Recs ── */
  function aiSiteFixRecFromBtn(btn) {
    let sampleUrls = [];
    try { sampleUrls = JSON.parse(btn.dataset.sampleUrls || '[]'); } catch {}
    aiSiteFixRec(btn, {
      checkName:  btn.dataset.checkName,
      failCount:  parseInt(btn.dataset.failCount, 10) || 0,
      pageCount:  parseInt(btn.dataset.pageCount, 10) || 0,
      sampleUrls,
      message:    btn.dataset.message || '',
    });
  }

  async function aiSiteFixRec(btn, { checkName, failCount, pageCount, sampleUrls, message }) {
    const forceRegenerate = btn.textContent.trim() === 'Regenerate →';
    if (!forceRegenerate && _aiSiteRecsCache[checkName]) {
      _showAiRec(btn, _aiSiteRecsCache[checkName]);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Generating...';
    try {
      const res = await fetch('/api/ai-fix-rec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: _latestSiteUrl, checkName, message, siteMode: true, failCount, pageCount, sampleUrls, reportId: _currentSiteReportId, forceRegenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        btn.textContent = data.message || 'Error';
        setTimeout(() => { btn.textContent = forceRegenerate ? 'Regenerate →' : 'AI Fix →'; btn.disabled = false; }, 3000);
        return;
      }
      _aiSiteRecsCache[checkName] = data.recommendation;
      _showAiRec(btn, data.recommendation);
    } catch {
      btn.textContent = 'Error — try again';
      setTimeout(() => { btn.textContent = forceRegenerate ? 'Regenerate →' : 'AI Fix →'; btn.disabled = false; }, 3000);
    }
  }

  /* ── AI Meta Generator ── */
  function _charCountClass(len, type) {
    if (type === 'title') return (len >= 50 && len <= 60) ? 'meta-char-ok' : (len >= 45 && len <= 65) ? 'meta-char-warn' : 'meta-char-bad';
    return (len >= 120 && len <= 155) ? 'meta-char-ok' : (len >= 110 && len <= 165) ? 'meta-char-warn' : 'meta-char-bad';
  }

  function _showMetaVariations(suggestEl, variations, type) {
    suggestEl.className = 'meta-suggestion meta-vars-wrap';
    suggestEl.innerHTML = '<div class="meta-vars">' + variations.map((v, i) => {
      const charClass = _charCountClass(v.length, type);
      return `<div class="meta-var-row">
        <div class="meta-var-header">
          <span class="meta-var-num">Option ${i + 1}</span>
          <span class="meta-char-count ${charClass}">${v.length} chars</span>
        </div>
        <div class="meta-var-text">${esc(v)}</div>
        <button class="rec-btn" data-copy="${esc(v)}" onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500)})">Copy</button>
      </div>`;
    }).join('') + '</div>';
  }

  async function generateMeta(url, type, btnEl) {
    const forceRegenerate = btnEl.textContent.trim().startsWith('Regenerate');
    btnEl.disabled = true;
    btnEl.textContent = 'Generating...';
    try {
      const res = await fetch('/api/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type, reportId: _currentReportId, forceRegenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        btnEl.textContent = data.message || 'Error';
        setTimeout(() => { btnEl.textContent = forceRegenerate ? 'Regenerate →' : 'Generate →'; btnEl.disabled = false; }, 3000);
        return;
      }
      const container = btnEl.closest('.row-inner');
      let suggestEl = container?.querySelector('.meta-suggestion');
      if (!suggestEl) {
        suggestEl = document.createElement('div');
        btnEl.insertAdjacentElement('afterend', suggestEl);
      }
      if (data.variations && Array.isArray(data.variations)) {
        _showMetaVariations(suggestEl, data.variations, type);
      } else {
        // Legacy: single generated string
        suggestEl.className = 'meta-suggestion';
        suggestEl.innerHTML = `<span class="meta-suggestion-text">${esc(data.generated)}</span> <button class="rec-btn" data-copy="${esc(data.generated)}" onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500)})">Copy</button>`;
      }
      btnEl.textContent = 'Regenerate →';
      btnEl.disabled = false;
    } catch {
      btnEl.textContent = 'Error — try again';
      setTimeout(() => { btnEl.textContent = forceRegenerate ? 'Regenerate →' : 'Generate →'; btnEl.disabled = false; }, 3000);
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
    showProgressUI();

    try {
      const logoUrl  = document.getElementById('logoUrlInput').value.trim();
      const jsRender = document.getElementById('jsRenderToggle')?.checked || false;
      const perfBudget = (() => {
        const lcpEl = document.getElementById('budgetLcp');
        const tbtEl = document.getElementById('budgetTbt');
        const jsEl  = document.getElementById('budgetJs');
        const wEl   = document.getElementById('budgetWeight');
        if (!lcpEl || lcpEl.closest('#perfBudgetSection')?.style.display === 'none') return null;
        return {
          maxLcp:    Number(lcpEl.value)  || 2500,
          maxTbt:    Number(tbtEl?.value) || 200,
          maxJsKb:   Number(jsEl?.value)  || 500,
          maxWeightKb: Number(wEl?.value) || 3000,
        };
      })();
      const res = await fetch('/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...(logoUrl && { logoUrl }), ...(jsRender && { jsRender: true }), ...(perfBudget && { perfBudget }) }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        stopSteps();
        handleAuditError(res, errData);
        return;
      }

      // Parse SSE stream from the response body
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let doneData = null;
      let errorMsg = null;
      const progressFill = document.getElementById('progressFill');
      const statusText   = document.getElementById('statusText');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let evt;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === 'progress') {
            const pct = Math.round((evt.completed / evt.total) * 100);
            if (progressFill) progressFill.style.width = pct + '%';
            if (statusText) statusText.textContent = (evt.check ? evt.check.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, '') : 'Checking') + '...';
            const ccEl = document.getElementById('checkCount');
            if (ccEl && evt.total) ccEl.textContent = evt.total;
          } else if (evt.type === 'done') {
            doneData = evt;
          } else if (evt.type === 'error') {
            errorMsg = evt.message || 'Audit failed.';
          }
        }
      }

      if (progressFill) progressFill.style.width = '100%';
      if (statusText) statusText.textContent = 'Done.';
      await new Promise(resolve => setTimeout(resolve, 400));
      stopSteps();

      if (errorMsg) { showError(errorMsg); return; }
      if (!doneData) { showError('Audit failed. Please try again.'); return; }

      renderResults(doneData);
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

  // T3-1: Local SEO sub-score check set
  const LOCAL_SEO_CHECKS = new Set([
    '[Technical] NAP Consistency', '[GEO] Google Business Profile',
    '[GEO] Service Schema', '[GEO] Service Area Content',
    '[GEO] Knowledge Graph Signals', '[GEO] Review Content',
    '[Technical] Geo Coordinates', '[Technical] Business Hours Schema',
    '[Technical] Aggregate Rating Schema',
  ]);

  // T3-2: E-Commerce sub-score check set
  const ECOMMERCE_CHECKS = new Set([
    '[Technical] Product Schema', '[Technical] Out-of-Stock Canonical',
    '[Technical] Aggregate Rating Schema', '[Technical] Schema Validation',
    '[Technical] Canonical Tag', '[Technical] Page Speed',
    '[Content] Title Tag', '[Content] Meta Description',
  ]);

  // Compute average normalized score for checks matching a given Set
  function calcSubScore(results, checkSet) {
    const matching = results.filter(r => checkSet.has(r.name));
    if (!matching.length) return null;
    const total = matching.reduce((sum, r) => {
      const s = r.score !== undefined ? Math.round((r.score / (r.maxScore || 100)) * 100) : (r.status === 'pass' ? 100 : r.status === 'warn' ? 50 : 0);
      return sum + s;
    }, 0);
    return Math.round(total / matching.length);
  }

  // Render a compact sub-score card (Local SEO or E-Commerce)
  function buildSubScoreCard(label, score, filterCat) {
    if (score === null) return '';
    const color = score >= 80 ? 'var(--pass)' : score >= 50 ? 'var(--warn)' : 'var(--fail)';
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    return `
    <div class="sub-score-card">
      <div class="sub-score-label">${label}</div>
      <div class="sub-score-value" style="color:${color}">${score}<span style="font-size:14px;opacity:0.6">/100</span></div>
      <div class="sub-score-grade" style="color:${color}">${grade}</div>
      <button class="sub-score-jump" onclick="applyPageFilter(document.querySelector('[data-cat=\\'${filterCat}\\']'),'cat')" style="color:${color};border-color:${color}">View ${label} checks ↓</button>
    </div>`;
  }

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
  function buildScoreHero({ grade, score, color, pass, warn, fail, catScores, idPrefix, auditLabel, auditUrl, subtitle }) {
    const p = idPrefix;
    const summary = subtitle !== undefined ? subtitle : (GRADE_LABELS[grade] || '');
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
  function _renderTopicCoverage(data) {
    const resultEl = document.getElementById('topicCoverageResult');
    if (!resultEl) return;
    const gaps = data.gaps || [];
    const isStructured = gaps.length > 0 && typeof gaps[0] === 'object';
    let html = '';
    if (isStructured && data.contentScore != null) {
      const scoreColor = data.contentScore >= 7 ? 'var(--pass)' : data.contentScore >= 4 ? 'var(--warn)' : 'var(--fail)';
      html += `<div class="tc-header">
        <div class="tc-score-block">
          <span class="tc-score-num" style="color:${scoreColor}">${data.contentScore}</span>
          <span class="tc-score-denom">/10</span>
          <span class="tc-score-label">Coverage Score</span>
        </div>
        ${data.scoreSummary ? `<div class="tc-score-summary">${esc(data.scoreSummary)}</div>` : ''}
      </div>`;
      const intentClass = (i) => i === 'commercial' ? 'tc-intent-commercial' : i === 'navigational' ? 'tc-intent-navigational' : 'tc-intent-informational';
      const priorityClass = (p) => p === 'high' ? 'tc-pri-high' : p === 'medium' ? 'tc-pri-medium' : 'tc-pri-low';
      html += '<div class="tc-gaps">' + gaps.map(gap =>
        `<div class="tc-gap-row">
          <div class="tc-gap-main">
            <span class="tc-gap-priority ${priorityClass(gap.priority)}">${esc(gap.priority || 'low')}</span>
            <span class="tc-gap-topic">${esc(gap.topic || '')}</span>
            <span class="tc-intent-badge ${intentClass(gap.intent)}">${esc(gap.intent || 'informational')}</span>
          </div>
          ${gap.suggestedAngle ? `<div class="tc-gap-angle">${esc(gap.suggestedAngle)}</div>` : ''}
        </div>`
      ).join('') + '</div>';
    } else {
      // Legacy: flat string array
      const flatGaps = isStructured ? gaps.map(g => g.topic || '') : gaps;
      html = '<ol class="topic-gaps-list">' + flatGaps.map(g => `<li class="topic-gap-item">${esc(g)}</li>`).join('') + '</ol>';
    }
    resultEl.innerHTML = html;
    resultEl.style.display = 'block';
  }

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
      _renderTopicCoverage(data);
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

    // Assessment header (new structured fields)
    let assessHtml = '';
    if (brief.contentGrade?.score != null) {
      const scoreColor = brief.contentGrade.score >= 7 ? 'var(--pass)' : brief.contentGrade.score >= 4 ? 'var(--warn)' : 'var(--fail)';
      const intentClass = (i) => {
        if (i === 'commercial') return 'cb-intent-commercial'
        if (i === 'transactional') return 'cb-intent-transactional'
        if (i === 'navigational') return 'cb-intent-navigational'
        return 'cb-intent-informational'
      };
      const urgencyClass = (u) => u === 'high' ? 'cb-urgency-high' : u === 'medium' ? 'cb-urgency-medium' : 'cb-urgency-low';
      assessHtml = `
        <div class="cb-assessment">
          <div class="cb-assess-score-block">
            <span class="cb-assess-score" style="color:${scoreColor}">${brief.contentGrade.score}</span>
            <span class="cb-assess-denom">/10</span>
            <span class="cb-assess-label">Content Score</span>
          </div>
          ${brief.primaryIntent ? `<span class="cb-assess-intent ${intentClass(brief.primaryIntent)}">${esc(brief.primaryIntent)}</span>` : ''}
          ${brief.urgency ? `<span class="cb-urgency ${urgencyClass(brief.urgency)}">${esc(brief.urgency)} priority</span>` : ''}
        </div>
        ${brief.contentGrade.summary ? `<div class="cb-assess-summary">${esc(brief.contentGrade.summary)}</div>` : ''}`;
    }

    // Word count progress bar
    let wcHtml = '';
    if (brief.recommendedWordCount && brief.currentWordCount != null) {
      const pct = Math.min(100, Math.round((brief.currentWordCount / brief.recommendedWordCount) * 100));
      wcHtml = `<div class="cb-section">
        <div class="cb-section-label">Word Count Gap</div>
        <div class="cb-wc-track"><div class="cb-wc-current" style="width:${pct}%"></div></div>
        <div class="cb-wc-labels">
          <span>Current: ${brief.currentWordCount.toLocaleString()} words</span>
          <span>Target: ${brief.recommendedWordCount.toLocaleString()} words</span>
        </div>
      </div>`;
    }

    const kw = (brief.targetKeywords || []).map(k => `<span class="cb-tag">${esc(k)}</span>`).join('');
    const outline = (brief.outline || []).map(s =>
      `<div class="cb-outline-row"><span class="cb-outline-heading">${esc(s.heading)}</span>${s.notes ? `<span class="cb-outline-notes">${esc(s.notes)}</span>` : ''}${s.wordTarget ? `<span class="cb-outline-word-target">~${s.wordTarget} words</span>` : ''}</div>`
    ).join('');
    const entities = (brief.mustIncludeEntities || []).map(e => `<span class="cb-tag cb-tag-entity">${esc(e)}</span>`).join('');
    const faqs = (brief.faqSuggestions || []).map(q => `<li class="topic-gap-item">${esc(q)}</li>`).join('');

    el.innerHTML = `
      ${assessHtml}
      ${wcHtml || (brief.recommendedWordCount && !brief.currentWordCount ? `<div class="cb-section"><div class="cb-section-label">Recommended Word Count</div><div class="cb-word-count">${brief.recommendedWordCount.toLocaleString()} words</div></div>` : '')}
      ${kw ? `<div class="cb-section"><div class="cb-section-label">Target Keywords</div><div class="cb-tags">${kw}</div></div>` : ''}
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

  /* ── Audit help docs (one-sentence why-it-matters per check) ── */
  const AUDIT_DOCS = {
    // Technical
    '[Technical] SSL / HTTPS':               'HTTPS encrypts data in transit and is a confirmed Google ranking signal — non-HTTPS pages are flagged as "Not Secure" in Chrome.',
    '[Technical] Crawlability':              'Search engines must be able to access and render your page; blocked pages are invisible to Google.',
    '[Technical] Meta Robots':               'Controls whether search engines can index this page and follow its links.',
    '[Technical] Canonical URL':             'Prevents duplicate-content penalties by telling Google which page version is the official one.',
    '[Technical] Canonical Chain':           'Multi-hop canonicals dilute signals and can cause crawlers to ignore the chain entirely.',
    '[Technical] Redirect Chain':            'Each extra hop adds latency and loses link equity; chains longer than 3 hops are frequently abandoned by crawlers.',
    '[Technical] Robots.txt Safety':         'A misconfigured robots.txt can accidentally block Googlebot from crawling your entire site.',
    '[Technical] Sitemap URL Validation':    'A valid XML sitemap is the primary way to ensure all pages are discovered and scheduled for crawling.',
    '[Technical] Broken Internal Links':     'Broken links waste crawl budget, harm user experience, and leak link equity.',
    '[Technical] Page Indexability':         'If noindex signals are present the page will not appear in any search results.',
    '[Technical] Hreflang / i18n Tags':      'Correct hreflang tags tell Google which language or region version to show to each user.',
    '[Technical] Pagination Tags':           'rel=prev/next signals help search engines understand multi-page content like blog archives.',
    '[Technical] Mobile Viewport':           'Missing viewport meta tag makes the page render at desktop width on mobile, failing Core Web Vitals.',
    '[Technical] Page Speed':                'Google uses Core Web Vitals as a page-experience ranking signal across all searches.',
    '[Technical] Server Response Time':      'Slow TTFB delays every subsequent resource and reduces how many pages Googlebot can crawl per day.',
    '[Technical] HTTP Version':              'HTTP/2 multiplexes multiple requests over one connection, cutting page load time significantly.',
    '[Technical] HTTP Compression':          'Gzip/Brotli compression cuts transfer sizes by up to 80%, directly improving load speed.',
    '[Technical] Cache-Control':             'Long cache TTLs reduce repeat-visit load times and lower server bandwidth costs.',
    '[Technical] Content Security Policy':   'CSP headers mitigate XSS attacks and are a baseline security trust signal.',
    '[Technical] Security Headers':          'HSTS, X-Content-Type-Options, and similar headers protect users and signal site trustworthiness.',
    '[Technical] Mixed Content':             'HTTP assets on an HTTPS page trigger browser security warnings that break user trust.',
    '[Technical] Cookie Consent':            'GDPR and CCPA require cookie consent mechanisms; missing them is a legal and trust risk.',
    '[Technical] Resource Hints':            'Preconnect and dns-prefetch hints eliminate DNS lookup delays for critical third-party resources.',
    '[Technical] Render-Blocking Resources': 'Undeferred scripts in <head> block the browser from rendering anything until they finish downloading.',
    '[Technical] Asset Minification':        'Minifying JS and CSS removes whitespace and comments, reducing file sizes and parse time.',
    '[Technical] Web App Manifest':          'A web manifest enables home-screen install and Progressive Web App features.',
    '[Technical] Crawl Delay':               'Crawl-delay directives slow how quickly Googlebot can discover and index new content.',
    '[Technical] X-Robots-Tag':              'An X-Robots-Tag: noindex header prevents indexing even when the page itself has no meta robots tag.',
    '[Technical] JavaScript Bundle Size':    'Oversized JS bundles extend Time to Interactive and hurt Core Web Vitals scores.',
    '[Technical] Image Lazy Loading':        'Lazy loading defers offscreen images, reducing initial page weight and improving LCP.',
    '[Technical] Image Dimensions':          'Explicit width and height attributes on images prevent Cumulative Layout Shift as the page loads.',
    '[Technical] Third-Party Scripts':       'Each third-party script adds a network round-trip and can significantly slow page load time.',
    '[Technical] AMP Page':                  'AMP pages qualify for Google fast-loading carousels and Top Stories on mobile.',
    '[Technical] URL Structure':             'Clean, descriptive URLs improve user trust and are easier for search engines to parse and rank.',
    '[Technical] DNS TTL':                   'An appropriate TTL ensures fast propagation during domain changes without excessive DNS lookup overhead.',
    '[Technical] Favicon':                   'A favicon builds brand recognition in browser tabs, bookmarks, and some search result displays.',
    '[Technical] Accessibility Signals':     'Accessible pages serve a wider audience and accessibility best practices overlap heavily with SEO signals.',
    '[Technical] Aggregate Rating':          'AggregateRating schema enables star-rating rich snippets in Google SERPs, boosting click-through rate.',
    '[Technical] BreadcrumbList Schema':     'Breadcrumb schema enables breadcrumb-trail rich results in Google, improving SERP appearance.',
    '[Technical] Structured Data Inventory': 'A full structured-data inventory confirms Google can discover and potentially display rich results.',
    '[Technical] Schema Required Fields':    'Missing required fields in JSON-LD prevent Google from rendering any rich results for this schema type.',
    '[Technical] Structured Data':           'Schema.org markup helps search engines understand page content and enables rich result eligibility.',
    '[Technical] Business Hours':            'Business hours in schema can surface directly in local Knowledge Panel and Google Search results.',
    '[Technical] Geo Coordinates':           'Latitude/longitude in schema helps local businesses surface in location-based and Google Maps searches.',
    '[Technical] Interaction to Next Paint': 'INP measures real-user input responsiveness and replaced FID as a Core Web Vital in March 2024.',
    '[Technical] Mobile Friendliness':       'Google uses mobile-first indexing, so mobile usability directly determines your organic rankings.',
    '[Technical] Internal Links':            'Internal links distribute PageRank across your site and help search engines discover related content.',
    // Content
    '[Content] Title Tag':                   'The <title> tag is the most impactful on-page SEO element — it appears in search results and browser tabs.',
    '[Content] H1 Heading':                  'Every page should have exactly one H1 that clearly states its primary topic.',
    '[Content] Meta Description':            'The meta description appears as your SERP snippet — a compelling one directly improves click-through rate.',
    '[Content] Meta Tags':                   'Complete meta tags ensure correct title and description display in search results and social shares.',
    '[Content] Image Alt Text':              'Alt text is the only way search engines understand image content and is required for screen reader accessibility.',
    '[Content] Open Graph & Social Tags':    'OG tags control how your page appears when shared on Facebook, LinkedIn, and other social platforms.',
    '[Content] OG Image Reachability':       'An unreachable OG image shows a broken or blank preview when your page is shared on social media.',
    '[Content] Content Length':              'Comprehensive content (700+ words) correlates strongly with higher rankings and more featured snippets.',
    '[Content] Readability':                 'Content at an 8th-grade reading level retains more readers, reduces bounce rate, and improves dwell time.',
    '[Content] Heading Hierarchy':           'A logical H1→H2→H3 structure helps search engines parse your page\'s semantic topics.',
    '[Content] Keyword Frequency':           'Appropriate keyword usage signals topical relevance without triggering spam filters.',
    '[Content] Content Freshness':           'Recently updated content is more likely to rank for time-sensitive queries and re-crawled by Googlebot.',
    '[Content] Outbound Links':              'Linking to authoritative sources signals trustworthiness and contextualizes your content topically.',
    '[Content] Content-to-Code Ratio':       'A low text-to-HTML ratio often indicates thin content or template bloat that dilutes page signals.',
    '[Content] Spelling & Grammar':          'Spelling errors undermine E-E-A-T trust signals and reduce reader confidence in your content.',
    '[Content] Passive Voice & Tone':        'Active, authoritative tone improves readability metrics and keeps readers engaged longer.',
    '[Content] Social Media Links':          'Social links connect your web presence to your broader brand and support entity recognition.',
    '[Content] Brand Consistency':           'Consistent brand name usage across pages strengthens entity recognition in Google\'s Knowledge Graph.',
    '[Content] Call to Action':              'Clear CTAs guide users toward conversion goals and reduce pogo-sticking back to search results.',
    '[Content] Image Optimization':          'Properly compressed and correctly sized images improve LCP and reduce total page weight.',
    '[Content] NAP Consistency':             'Matching Name, Address, and Phone across your site is a foundational local SEO signal.',
    '[Content] E-E-A-T Signals':             'Experience, Expertise, Authority, and Trust signals are weighted heavily for YMYL (health, finance, legal) content.',
    // AEO
    '[AEO] FAQ / Q&A Schema':               'FAQPage schema can generate accordion-style FAQ rich results in Google, expanding your SERP real estate.',
    '[AEO] How-To Schema':                  'HowTo schema enables step-by-step rich results that can dominate answer positions for instructional queries.',
    '[AEO] Article Schema':                 'Article schema qualifies your content for News/Article rich results and Google Top Stories.',
    '[AEO] Video Schema':                   'VideoObject schema enables thumbnail-rich video results and can appear in Google\'s video carousel.',
    '[AEO] Speakable Schema':               'Speakable schema marks content appropriate for text-to-speech responses in Google Assistant and voice search.',
    '[AEO] Featured Snippet Format':        'Content structured as definitions, numbered lists, or tables is most likely to win featured snippet positions.',
    '[AEO] Question-Based Headings':        'Question-form H2/H3 headings directly match conversational queries and improve People Also Ask visibility.',
    '[AEO] Concise Answer Paragraphs':      '40–60 word paragraphs immediately after question headings are the format Google extracts for featured snippets.',
    '[AEO] Answer-First Structure':         'Placing the answer before the explanation matches how voice assistants and AI engines select content.',
    '[AEO] Q&A Heading Density':            'More question-heading pairs increase the number of queries your page can potentially answer.',
    '[AEO] Definition Content':             'Definition-format content ("X is Y") is the most frequently extracted featured snippet type.',
    '[AEO] Comparison Content':             'Structured comparisons and versus-style content are prime candidates for featured snippet extraction.',
    '[AEO] Table Content for AI Citation':  'Tables are frequently pulled into featured snippets for best-of and comparison queries.',
    // GEO
    '[GEO] E-E-A-T Signals':               'E-E-A-T (Experience, Expertise, Authority, Trust) is Google\'s framework for evaluating content quality in AI-era search.',
    '[GEO] Organization Entity Clarity':    'Clearly disambiguating your organization helps AI models correctly identify and cite your brand.',
    '[GEO] Brand Disambiguation':           'Explicit brand disambiguation prevents AI models from confusing you with similarly-named entities.',
    '[GEO] sameAs Link Authority':          'sameAs links to Wikipedia, Wikidata, and LinkedIn strengthen your entity\'s Knowledge Graph presence.',
    '[GEO] Source Citations':               'Citing authoritative sources signals factual rigor, which AI models use to evaluate citation-worthiness.',
    '[GEO] Fact Density':                   'Pages rich in specific, verifiable facts are more likely to be cited as sources by AI answer engines.',
    '[GEO] Author Schema':                  'Explicit Person schema for authors supports E-A-T and makes content attributable to a real expert.',
    '[GEO] Google Business Profile':        'A verified, complete GBP listing is the primary signal for Google Maps and local pack visibility.',
    '[GEO] Knowledge Graph Entity Depth':   'Rich Knowledge Graph signals make your brand recognizable to AI models and eligible for entity cards.',
    '[GEO] Multi-Modal Content':            'Pages with images, video, and data are more likely to surface across AI multi-modal answer formats.',
    '[GEO] Privacy & Trust Signals':        'Privacy policies and terms pages are YMYL trust requirements evaluated by both Google and AI content scorers.',
    '[GEO] Review Content Visible':         'Testimonials and reviews are strong social-proof signals that AI models use to assess credibility.',
    '[GEO] Service / Product Schema':       'Service and Product schema help search engines understand your offerings and enable local search features.',
    '[GEO] Service Area Content':           'Explicit geographic coverage content improves relevance for location-targeted and "near me" searches.',
    '[GEO] Semantic HTML Structure':        'Semantic HTML5 elements (article, section, nav) make content structure interpretable by AI models.',
    '[GEO] Structured Content for AI':      'Well-organized content with clear sections is easier for AI models to parse and cite accurately.',
    '[GEO] AI Citation Signals':            'Composite score of signals that predict whether AI answer engines like ChatGPT will cite your content.',
    '[GEO] AI Crawler Access':              'Blocking GPTBot, ClaudeBot, or PerplexityBot in robots.txt prevents AI models from indexing your content.',
    '[GEO] llms.txt':                       '/llms.txt is an emerging standard that tells AI systems which of your content can be used and how.',
    '[GEO] AI Search Presence':             'Measures whether your brand is actually cited in live AI-generated answers across platforms like Perplexity.',
  };

  /* ── Effort × Impact metadata (effort: low/medium/high, impact: low/medium/high) ── */
  // Quick Win = low effort + high/medium impact
  // Strategic = high/medium effort + high impact
  // Fill-in   = low effort + low impact
  // Deprioritize = high/medium effort + low/medium impact
  const AUDIT_METADATA = {
    '[Technical] SSL / HTTPS':               { effort: 'low',    impact: 'high'   },
    '[Technical] Crawlability':              { effort: 'low',    impact: 'high'   },
    '[Technical] Meta Robots':               { effort: 'low',    impact: 'high'   },
    '[Technical] Canonical URL':             { effort: 'low',    impact: 'high'   },
    '[Technical] Canonical Chain':           { effort: 'medium', impact: 'high'   },
    '[Technical] Redirect Chain':            { effort: 'medium', impact: 'high'   },
    '[Technical] Robots.txt Safety':         { effort: 'low',    impact: 'high'   },
    '[Technical] Sitemap URL Validation':    { effort: 'low',    impact: 'high'   },
    '[Technical] Broken Internal Links':     { effort: 'medium', impact: 'high'   },
    '[Technical] Page Indexability':         { effort: 'low',    impact: 'high'   },
    '[Technical] Hreflang / i18n Tags':      { effort: 'medium', impact: 'medium' },
    '[Technical] Pagination Tags':           { effort: 'low',    impact: 'low'    },
    '[Technical] Mobile Viewport':           { effort: 'low',    impact: 'high'   },
    '[Technical] Page Speed':                { effort: 'high',   impact: 'high'   },
    '[Technical] Server Response Time':      { effort: 'medium', impact: 'high'   },
    '[Technical] HTTP Version':              { effort: 'high',   impact: 'medium' },
    '[Technical] HTTP Compression':          { effort: 'medium', impact: 'medium' },
    '[Technical] Cache-Control':             { effort: 'medium', impact: 'medium' },
    '[Technical] Content Security Policy':   { effort: 'low',    impact: 'medium' },
    '[Technical] Security Headers':          { effort: 'low',    impact: 'high'   },
    '[Technical] Mixed Content':             { effort: 'medium', impact: 'high'   },
    '[Technical] Cookie Consent':            { effort: 'medium', impact: 'low'    },
    '[Technical] Resource Hints':            { effort: 'low',    impact: 'medium' },
    '[Technical] Render-Blocking Resources': { effort: 'medium', impact: 'high'   },
    '[Technical] Asset Minification':        { effort: 'medium', impact: 'medium' },
    '[Technical] Web App Manifest':          { effort: 'low',    impact: 'low'    },
    '[Technical] Crawl Delay':               { effort: 'low',    impact: 'medium' },
    '[Technical] X-Robots-Tag':              { effort: 'low',    impact: 'medium' },
    '[Technical] JavaScript Bundle Size':    { effort: 'high',   impact: 'medium' },
    '[Technical] Image Lazy Loading':        { effort: 'low',    impact: 'medium' },
    '[Technical] Image Dimensions':          { effort: 'low',    impact: 'medium' },
    '[Technical] Third-Party Scripts':       { effort: 'medium', impact: 'medium' },
    '[Technical] AMP Page':                  { effort: 'high',   impact: 'low'    },
    '[Technical] URL Structure':             { effort: 'medium', impact: 'medium' },
    '[Technical] DNS TTL':                   { effort: 'low',    impact: 'low'    },
    '[Technical] Favicon':                   { effort: 'low',    impact: 'low'    },
    '[Technical] Accessibility Signals':     { effort: 'medium', impact: 'medium' },
    '[Technical] Aggregate Rating':          { effort: 'medium', impact: 'high'   },
    '[Technical] BreadcrumbList Schema':     { effort: 'low',    impact: 'medium' },
    '[Technical] Structured Data Inventory': { effort: 'medium', impact: 'medium' },
    '[Technical] Schema Required Fields':    { effort: 'medium', impact: 'high'   },
    '[Technical] Structured Data':           { effort: 'medium', impact: 'high'   },
    '[Technical] Business Hours':            { effort: 'low',    impact: 'medium' },
    '[Technical] Geo Coordinates':           { effort: 'low',    impact: 'medium' },
    '[Technical] Interaction to Next Paint': { effort: 'high',   impact: 'high'   },
    '[Technical] Mobile Friendliness':       { effort: 'medium', impact: 'high'   },
    '[Technical] Internal Links':            { effort: 'medium', impact: 'high'   },
    '[Content] Title Tag':                   { effort: 'low',    impact: 'high'   },
    '[Content] H1 Heading':                  { effort: 'low',    impact: 'high'   },
    '[Content] Meta Description':            { effort: 'low',    impact: 'high'   },
    '[Content] Meta Tags':                   { effort: 'low',    impact: 'medium' },
    '[Content] Image Alt Text':              { effort: 'medium', impact: 'high'   },
    '[Content] Open Graph & Social Tags':    { effort: 'low',    impact: 'medium' },
    '[Content] OG Image Reachability':       { effort: 'low',    impact: 'medium' },
    '[Content] Content Length':              { effort: 'high',   impact: 'high'   },
    '[Content] Readability':                 { effort: 'medium', impact: 'medium' },
    '[Content] Heading Hierarchy':           { effort: 'low',    impact: 'medium' },
    '[Content] Keyword Frequency':           { effort: 'low',    impact: 'medium' },
    '[Content] Content Freshness':           { effort: 'medium', impact: 'medium' },
    '[Content] Outbound Links':              { effort: 'low',    impact: 'medium' },
    '[Content] Content-to-Code Ratio':       { effort: 'medium', impact: 'low'    },
    '[Content] Spelling & Grammar':          { effort: 'medium', impact: 'medium' },
    '[Content] Passive Voice & Tone':        { effort: 'medium', impact: 'low'    },
    '[Content] Social Media Links':          { effort: 'low',    impact: 'low'    },
    '[Content] Brand Consistency':           { effort: 'low',    impact: 'low'    },
    '[Content] Call to Action':              { effort: 'medium', impact: 'medium' },
    '[Content] Image Optimization':          { effort: 'medium', impact: 'medium' },
    '[Content] NAP Consistency':             { effort: 'low',    impact: 'high'   },
    '[Content] E-E-A-T Signals':             { effort: 'high',   impact: 'high'   },
    '[AEO] FAQ / Q&A Schema':               { effort: 'medium', impact: 'high'   },
    '[AEO] How-To Schema':                  { effort: 'medium', impact: 'high'   },
    '[AEO] Article Schema':                 { effort: 'low',    impact: 'medium' },
    '[AEO] Video Schema':                   { effort: 'medium', impact: 'medium' },
    '[AEO] Speakable Schema':               { effort: 'medium', impact: 'medium' },
    '[AEO] Featured Snippet Format':        { effort: 'medium', impact: 'high'   },
    '[AEO] Question-Based Headings':        { effort: 'low',    impact: 'high'   },
    '[AEO] Concise Answer Paragraphs':      { effort: 'low',    impact: 'high'   },
    '[AEO] Answer-First Structure':         { effort: 'low',    impact: 'high'   },
    '[AEO] Q&A Heading Density':            { effort: 'medium', impact: 'medium' },
    '[AEO] Definition Content':             { effort: 'medium', impact: 'medium' },
    '[AEO] Comparison Content':             { effort: 'medium', impact: 'medium' },
    '[AEO] Table Content for AI Citation':  { effort: 'medium', impact: 'medium' },
    '[GEO] E-E-A-T Signals':               { effort: 'high',   impact: 'high'   },
    '[GEO] Organization Entity Clarity':    { effort: 'medium', impact: 'high'   },
    '[GEO] Brand Disambiguation':           { effort: 'low',    impact: 'medium' },
    '[GEO] sameAs Link Authority':          { effort: 'low',    impact: 'medium' },
    '[GEO] Source Citations':               { effort: 'medium', impact: 'medium' },
    '[GEO] Fact Density':                   { effort: 'high',   impact: 'medium' },
    '[GEO] Author Schema':                  { effort: 'low',    impact: 'medium' },
    '[GEO] Google Business Profile':        { effort: 'low',    impact: 'high'   },
    '[GEO] Knowledge Graph Entity Depth':   { effort: 'high',   impact: 'medium' },
    '[GEO] Multi-Modal Content':            { effort: 'medium', impact: 'medium' },
    '[GEO] Privacy & Trust Signals':        { effort: 'low',    impact: 'medium' },
    '[GEO] Review Content Visible':         { effort: 'medium', impact: 'medium' },
    '[GEO] Service / Product Schema':       { effort: 'medium', impact: 'medium' },
    '[GEO] Service Area Content':           { effort: 'medium', impact: 'medium' },
    '[GEO] Semantic HTML Structure':        { effort: 'low',    impact: 'medium' },
    '[GEO] Structured Content for AI':      { effort: 'medium', impact: 'medium' },
    '[GEO] AI Citation Signals':            { effort: 'high',   impact: 'high'   },
    '[GEO] AI Crawler Access':              { effort: 'low',    impact: 'high'   },
    '[GEO] llms.txt':                       { effort: 'low',    impact: 'medium' },
    '[GEO] AI Search Presence':             { effort: 'high',   impact: 'high'   },
  };

  function _matrixQuadrant(name) {
    const m = AUDIT_METADATA[name];
    if (!m) return 'deprioritize';
    if (m.effort === 'low' && (m.impact === 'high' || m.impact === 'medium')) return 'quickwin';
    if (m.impact === 'high') return 'strategic';
    if (m.effort === 'low' && m.impact === 'low') return 'fillin';
    return 'deprioritize';
  }

  function buildMatrixView(results) {
    const failing = results.filter(r => r.status !== 'pass');
    if (!failing.length) return '<div class="matrix-empty">No failing or warning checks — nothing to prioritize.</div>';

    const quadrants = { quickwin: [], strategic: [], fillin: [], deprioritize: [] };
    for (const r of failing) quadrants[_matrixQuadrant(r.name)].push(r);

    const showFix = ((_currentUser && (_currentUser.plan === 'pro' || _currentUser.plan === 'agency')) || window._sgPlan === 'pro' || window._sgPlan === 'agency') && !!_currentReportId;
    function renderItems(items) {
      if (!items.length) return '<div class="matrix-cell-empty">None</div>';
      return items.map(r => {
        const cat = resultCategory(r.name);
        const catColors = { technical: '#8892a4', content: '#e8a87c', aeo: '#7baeff', geo: '#b07bff' };
        const c = catColors[cat] || '#8892a4';
        const curStatus = _fixStatuses[r.name] || 'todo';
        return `<div class="matrix-item ${r.status}" data-cat="${cat}">
          <span class="matrix-item-icon">${statusIcon(r.status)}</span>
          <span class="matrix-item-cat" style="color:${c}">${CAT_LABELS[cat]?.short || ''}</span>
          <span class="matrix-item-name">${esc(stripAuditPrefix(r.name))}</span>
          ${showFix ? `<button class="fix-status-btn matrix-item-fix" data-check="${esc(r.name)}" style="color:${FIX_COLOR[curStatus]}" onclick="cycleFixStatus(this)">${FIX_LABEL[curStatus]}</button>` : ''}
        </div>`;
      }).join('');
    }

    return `<div class="matrix-grid">
      <div class="matrix-cell matrix-cell-qw">
        <div class="matrix-cell-label">⚡ Quick Wins</div>
        <div class="matrix-cell-sub">Low effort · High impact</div>
        ${renderItems(quadrants.quickwin)}
      </div>
      <div class="matrix-cell matrix-cell-st">
        <div class="matrix-cell-label">🎯 Strategic</div>
        <div class="matrix-cell-sub">High effort · High impact</div>
        ${renderItems(quadrants.strategic)}
      </div>
      <div class="matrix-cell matrix-cell-fi">
        <div class="matrix-cell-label">○ Fill-ins</div>
        <div class="matrix-cell-sub">Low effort · Low impact</div>
        ${renderItems(quadrants.fillin)}
      </div>
      <div class="matrix-cell matrix-cell-dp">
        <div class="matrix-cell-label">↓ Deprioritize</div>
        <div class="matrix-cell-sub">High effort · Low impact</div>
        ${renderItems(quadrants.deprioritize)}
      </div>
    </div>`;
  }

  function setResultView(mode) {
    const listBtn   = document.getElementById('viewListBtn');
    const matrixBtn = document.getElementById('viewMatrixBtn');
    const rows      = document.getElementById('resultRows');
    const matrix    = document.getElementById('matrixView');
    const cards     = document.getElementById('cardStrip');
    const cardsLbl  = document.getElementById('cardsLabel');
    const detailLbl = document.getElementById('detailLabel');
    if (!rows || !matrix) return;

    if (mode === 'matrix') {
      rows.style.display      = 'none';
      if (cards) cards.style.display    = 'none';
      if (cardsLbl) cardsLbl.style.display = 'none';
      if (detailLbl) detailLbl.textContent = 'Effort × Impact Matrix';
      matrix.style.display = 'block';
      if (!matrix.dataset.built) {
        matrix.innerHTML = buildMatrixView(window._lastAuditData?.results || []);
        matrix.dataset.built = '1';
      }
      if (listBtn)   listBtn.classList.remove('active');
      if (matrixBtn) matrixBtn.classList.add('active');
    } else {
      rows.style.display      = '';
      if (cards) cards.style.display    = '';
      if (cardsLbl) cardsLbl.style.display = '';
      if (detailLbl) detailLbl.textContent = 'Detailed Findings';
      matrix.style.display = 'none';
      if (listBtn)   listBtn.classList.add('active');
      if (matrixBtn) matrixBtn.classList.remove('active');
    }
  }

  /* ── Render results ── */
  function renderResults(data) {
    window._lastAuditData = data;
    _activeStatus = 'all';
    _activeCat    = 'all';

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

    // Initialize fix tracker state from saved report data (only in saved report view)
    const showFixTracker = isPro && !!_currentReportId;
    _fixStatuses = {};
    if (showFixTracker && data.fixes) {
      for (const [k, v] of Object.entries(data.fixes)) _fixStatuses[k] = v;
    }

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
        ${isPro ? `<button id="compareBtn" class="pdf-link" style="background:none;cursor:pointer;color:#7baeff;border-color:#7baeff" onclick="if(!document.getElementById('modePageBtn')){window.location.href='/?compare='+encodeURIComponent('${esc(data.url)}');return;}setMode('multi');const rows=document.querySelectorAll('#multiInputWrap .multi-loc-url');if(rows[0])rows[0].value='${esc(data.url)}';if(!rows[1])addMultiRow();document.querySelectorAll('#multiInputWrap .multi-loc-url')[1]?.focus();document.getElementById('multiInputWrap')?.scrollIntoView({behavior:'smooth',block:'center'});">
          <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
          Compare vs. Competitor →
        </button>` : ''}
      </div>

      ${(data.aiSummary || data.ai_summary) ? _renderExecSummaryCard(data.aiSummary || data.ai_summary, 'pageAiSummaryCard') : window._sgPlan === 'free' ? `
      <div class="ai-summary-card ai-summary-locked" id="pageAiSummaryCard">
        <div class="ai-summary-label">AI Executive Summary</div>
        <div class="ai-summary-text ai-summary-blur">Upgrade to Pro for an AI-generated summary with specific recommendations for this page.</div>
        <a href="/pricing" class="ai-summary-upgrade">Upgrade to Pro →</a>
      </div>` : isPro ? `
      <div class="ai-summary-card" id="pageAiSummaryCard">
        <div class="ai-summary-label">AI Executive Summary</div>
        <div class="ai-summary-text" style="color:var(--muted)">Generating summary…</div>
      </div>` : `
      <div class="ai-summary-card" id="pageAiSummaryCard" style="opacity:0.5">
        <div class="ai-summary-label">AI Executive Summary</div>
        <div class="ai-summary-text" style="color:var(--muted)">AI summary unavailable — set GROQ_API_KEY to enable.</div>
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

      <!-- Fix Tracker Progress Bar -->
      ${showFixTracker ? (() => {
        const totalCount = results.length;
        const fixedCount = Object.values(_fixStatuses).filter(s => s === 'fixed').length;
        const pct = totalCount ? Math.round(fixedCount / totalCount * 100) : 0;
        return `<div class="fix-progress-wrap" id="fixProgressWrap">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="fix-progress-label" style="font-family:'Space Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted)">Fix Tracker</div>
            <div id="fixProgressLabel" style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted)">${fixedCount} / ${totalCount} checks resolved</div>
          </div>
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
            <div id="fixProgressBar" style="height:100%;background:var(--pass);border-radius:2px;width:${pct}%;transition:width 0.3s ease" data-total="${totalCount}"></div>
          </div>
        </div>`;
      })() : ''}

      <!-- Score Target Roadmap -->
      ${(function() {
        const nonPass = results.filter(r => r.status !== 'pass');
        if (!nonPass.length) return '';
        const nextGradeTarget = data.totalScore >= 90 ? null : data.totalScore >= 80 ? 90 : data.totalScore >= 70 ? 80 : data.totalScore >= 60 ? 70 : 60;
        return `<div class="score-target-card" id="scoreTargetCard">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
            <div class="score-target-label">Improvement Roadmap</div>
            <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
              <span style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted)">Target score:</span>
              <select id="scoreTargetSelect" class="sg-select" onchange="renderScoreRoadmap(window._lastAuditData&&window._lastAuditData.results||[],${data.totalScore},this.value)">
                <option value="60" ${nextGradeTarget===60?'selected':''}>60 (D)</option>
                <option value="70" ${nextGradeTarget===70?'selected':''}>70 (C)</option>
                <option value="80" ${nextGradeTarget===80?'selected':''}>80 (B)</option>
                <option value="90" ${nextGradeTarget===90?'selected':''}>90 (A)</option>
              </select>
            </div>
          </div>
          <div id="scoreRoadmapList"></div>
        </div>`;
      })()}

      ${(function() {
        // T3-1 Local SEO card + T3-2 E-Commerce card
        const localScore = calcSubScore(results, LOCAL_SEO_CHECKS);
        const hasProduct = results.some(r => r.name === '[Technical] Product Schema' && (r.status === 'pass' || r.status === 'warn'));
        const ecomScore  = hasProduct ? calcSubScore(results, ECOMMERCE_CHECKS) : null;
        if (localScore === null && ecomScore === null) return '';
        return `<div class="sub-score-row">
          ${localScore !== null ? buildSubScoreCard('Local SEO Score', localScore, 'geo') : ''}
          ${ecomScore  !== null ? buildSubScoreCard('E-Commerce Score', ecomScore, 'technical') : ''}
        </div>`;
      })()}

      <!-- Filter bar -->
      <div class="result-filter-bar" id="resultFilterBar">
        <div class="rfb-group">
          <button class="rfb-btn active" data-status="all"   onclick="applyPageFilter(this,'status')">All</button>
          <button class="rfb-btn"        data-status="fail"  onclick="applyPageFilter(this,'status')">Fails</button>
          <button class="rfb-btn"        data-status="warn"  onclick="applyPageFilter(this,'status')">Warnings</button>
          <button class="rfb-btn"        data-status="pass"  onclick="applyPageFilter(this,'status')">Passed</button>
        </div>
        <div class="rfb-group">
          <button class="rfb-pill active" data-cat="all"       onclick="applyPageFilter(this,'cat')">All</button>
          <button class="rfb-pill"        data-cat="technical" onclick="applyPageFilter(this,'cat')" style="color:#8892a4;border-color:#8892a4">Technical</button>
          <button class="rfb-pill"        data-cat="content"   onclick="applyPageFilter(this,'cat')" style="color:#e8a87c;border-color:#e8a87c">Content</button>
          <button class="rfb-pill"        data-cat="aeo"       onclick="applyPageFilter(this,'cat')" style="color:#7baeff;border-color:#7baeff">AEO</button>
          <button class="rfb-pill"        data-cat="geo"       onclick="applyPageFilter(this,'cat')" style="color:#b07bff;border-color:#b07bff">GEO</button>
        </div>
        ${isPro ? `<div class="rfb-view-toggle">
          <button class="rfb-view-btn active" id="viewListBtn"   onclick="setResultView('list')">≡ List</button>
          <button class="rfb-view-btn"        id="viewMatrixBtn" onclick="setResultView('matrix')">⊞ Matrix</button>
        </div>` : ''}
      </div>

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
      const cardCat = resultCategory(r.name);
      html += `
        <div class="audit-card ${r.status}" data-cat="${cardCat}">
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
        <div class="result-row" data-cat="${cat}">
          <div class="row-inner">
            <div class="row-header">
              <div class="row-name">${(() => {
                const CAT_COLOR_MAP = { technical: '#8892a4', content: '#e8a87c', aeo: '#7baeff', geo: '#b07bff' };
                const m = r.name.match(/^(\[(Technical|Content|AEO|GEO)\])\s*(.*)/s);
                return m
                  ? `<span style="color:${CAT_COLOR_MAP[cat]};font-size:10px;font-family:'Space Mono',monospace;letter-spacing:0.04em;margin-right:4px">${esc(m[1])}</span>${esc(m[3])}`
                  : esc(r.name);
              })()}${AUDIT_DOCS[r.name] ? `<span class="audit-help" data-tooltip="${esc(AUDIT_DOCS[r.name])}">?</span>` : ''}</div>
              <div class="row-score-right">
                <div class="row-score-val ${r.status}">${hasScore ? r.normalizedScore + '/100' : ''}</div>
              </div>
            </div>
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
            <div class="row-footer">
              <span class="row-status ${r.status}">${statusIcon(r.status)}</span>
              ${showFixTracker ? (() => {
                const curStatus = _fixStatuses[r.name] || 'todo';
                return `<button class="fix-status-btn" data-check="${esc(r.name)}" style="color:${FIX_COLOR[curStatus]}" onclick="cycleFixStatus(this)">${FIX_LABEL[curStatus]}</button>`;
              })() : ''}
            </div>
          </div>
        </div>`;
    }

    html += `</div><div id="matrixView" style="display:none"></div>`;
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
        const cb = document.getElementById('compareBtn');    if (cb) cb.classList.add('in');
        const sp = document.getElementById('serpPreview');   if (sp) sp.classList.add('in');
      }, 600);
      setTimeout(() => { document.getElementById('pageAiSummaryCard')?.classList.add('in'); }, 650);
      setTimeout(() => {
        document.getElementById('resultFilterBar')?.classList.add('in');
        // Auto-render roadmap with the pre-selected target
        const sel = document.getElementById('scoreTargetSelect');
        if (sel) renderScoreRoadmap(results, data.totalScore, sel.value);
      }, 680);
      setTimeout(() => {
        const tc = document.getElementById('topicCoverageCard');
        if (tc) { tc.style.opacity = ''; tc.classList.add('in'); }
        // Pre-populate cached topic coverage
        const hasTopicCache = _cachedTopicGaps && (Array.isArray(_cachedTopicGaps) ? _cachedTopicGaps.length > 0 : (_cachedTopicGaps.gaps?.length > 0));
        if (hasTopicCache) {
          const tcData = Array.isArray(_cachedTopicGaps) ? { gaps: _cachedTopicGaps } : _cachedTopicGaps;
          _renderTopicCoverage(tcData);
          const btn = document.getElementById('topicCoverageBtn');
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

      // Auto-generate AI features if not already cached (Pro/Agency only, requires saved report for caching)
      if (isPro && _currentReportId) {
        // Exec summary — generate if missing
        if (!(data.aiSummary || data.ai_summary)) {
          setTimeout(() => {
            fetch('/api/ai-exec-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: data.url, reportId: _currentReportId }),
            }).then(r => r.ok ? r.json() : null).then(d => {
              if (!d?.aiSummary) return;
              const card = document.getElementById('pageAiSummaryCard');
              if (!card) return;
              card.outerHTML = _renderExecSummaryCard(d.aiSummary, 'pageAiSummaryCard');
              document.getElementById('pageAiSummaryCard')?.classList.add('in');
            }).catch(() => {});
          }, 800);
        }
        // Topic coverage — auto-trigger if no cache (button still shows default text)
        setTimeout(() => {
          const tcBtn = document.getElementById('topicCoverageBtn');
          if (tcBtn && tcBtn.textContent === 'Analyze Topic Coverage →') analyzeTopicCoverage(tcBtn);
        }, 1400);
        // Content brief — auto-trigger after topic coverage has started
        setTimeout(() => {
          const cbBtn = document.getElementById('contentBriefBtn');
          if (cbBtn && cbBtn.textContent === 'Generate Content Brief →') generateContentBrief(cbBtn);
        }, 2000);
      }

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
      renderMultiResults({ ...data, comparisonInsight: data.comparisonInsight ?? null }, prevHistory);
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

  function _renderComparisonInsight(insight) {
    if (!insight) return '';
    const winnerHtml = insight.winner ? `
      <div class="cmp-winner-row">
        <span class="cmp-winner-badge">Winner</span>
        <span class="cmp-winner-url">${esc(toDomain(insight.winner.url || ''))}</span>
        ${insight.winner.reason ? `<span class="cmp-winner-reason">${esc(insight.winner.reason)}</span>` : ''}
      </div>` : '';
    const sharedHtml = (insight.sharedIssues || []).length ? `
      <div class="cmp-shared-issues">
        <div class="cmp-section-label">Shared Issues</div>
        ${(insight.sharedIssues || []).map(s => {
          const area = (s.area || 'Technical').toLowerCase();
          const impact = (s.impact || 'medium').toLowerCase();
          return `<div class="exec-issue-row">
            <span class="exec-issue-area exec-area-${area}">${esc(s.area || 'Technical')}</span>
            <span class="exec-issue-finding">${esc(s.name || '')}</span>
            <span class="exec-impact exec-impact-${impact}">${esc(s.impact || 'medium')}</span>
          </div>`;
        }).join('')}
      </div>` : '';
    const diffHtml = (insight.differentiators || []).length ? `
      <div class="cmp-differentiators">
        <div class="cmp-section-label">Key Differentiators</div>
        ${(insight.differentiators || []).map(d => `
          <div class="cmp-diff-row">
            <span class="cmp-diff-url">${esc(toDomain(d.url || ''))}</span>
            <span class="cmp-diff-advantage">${esc(d.advantage || '')}</span>
          </div>`).join('')}
      </div>` : '';
    const qwHtml = insight.quickWin ? `
      <div class="cmp-quick-win">
        <span class="exec-qw-label">Quick Win</span>
        <span class="exec-qw-text">${esc(insight.quickWin)}</span>
      </div>` : '';
    return `<div class="cmp-insight-card">
      <div class="cmp-insight-label">AI Comparison Insights</div>
      ${winnerHtml}${sharedHtml}${diffHtml}${qwHtml}
    </div>`;
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

  function renderMultiResults({ locations, pdfFile, comparisonInsight }, prevHistory) {
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
        const multiCatColorMap = { technical: '#8892a4', content: '#e8a87c', aeo: '#7baeff', geo: '#b07bff' };
      commonIssuesHtml += `
          <div class="result-row">
            <div class="row-inner">
              <div class="row-header">
                <div class="row-name"><span style="color:${multiCatColorMap[cat]};font-size:10px;font-family:'Space Mono',monospace;letter-spacing:0.04em;margin-right:4px">[${CAT_LABELS[cat].short}]</span>${esc(dispName)}</div>
                <div class="row-score-right">
                  <span class="site-count-fail">${issue.failCount}/${locations.length} locations</span>
                  ${issue.warnCount ? `<span class="site-count-warn" style="font-size:11px">+${issue.warnCount} warn</span>` : ''}
                </div>
              </div>
              <div class="row-footer">
                <span class="row-status fail">${statusIcon('fail')}</span>
              </div>
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
        ${_renderComparisonInsight(comparisonInsight)}
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

    const crawlParams = new URLSearchParams({ url });
    const maxDepthEl     = document.getElementById('crawlMaxDepth');
    const crawlDelayEl   = document.getElementById('crawlDelayMs');
    const excludeEl      = document.getElementById('crawlExcludePatterns');
    const includeEl      = document.getElementById('crawlIncludePatterns');
    const spellingEl     = document.getElementById('crawlSpellingCheck');
    if (maxDepthEl?.value)   crawlParams.set('maxDepth',         maxDepthEl.value);
    if (crawlDelayEl?.value) crawlParams.set('crawlDelay',       crawlDelayEl.value);
    if (excludeEl?.value)    crawlParams.set('excludePatterns',  excludeEl.value);
    if (includeEl?.value)    crawlParams.set('includePatterns',  includeEl.value);
    if (spellingEl?.checked) crawlParams.set('spellingCheck',    '1');
    const es = new EventSource(`/crawl?${crawlParams}`);
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

  function renderSiteResults({ pageCount, results, siteUrl, pdfFile, depthDistribution, dirCounts, linkEquity, responseStats, aiSummary, linkOpportunities, graphNodes, graphLinks, siteReportId, siteScore: serverScore, siteGrade: serverGrade }) {
    _latestSiteResults = results;
    _latestSiteUrl     = siteUrl;
    _currentSiteReportId = siteReportId ?? null;
    _aiSiteRecsCache = {};

    // Reset batch meta panel state for new audit
    _batchMetaPanelPopulated = false;

    // Collect pages with title/meta desc issues for batch generation (Pro+)
    const _batchPageInfo = {};
    for (const r of results) {
      if (r.name === '[Content] Title Tag') {
        [...r.fail, ...r.warn].forEach(u => {
          if (!_batchPageInfo[u]) _batchPageInfo[u] = {};
          _batchPageInfo[u].titleIssue = true;
        });
      }
      if (r.name === '[Content] Meta Description') {
        [...r.fail, ...r.warn].forEach(u => {
          if (!_batchPageInfo[u]) _batchPageInfo[u] = {};
          _batchPageInfo[u].descIssue = true;
        });
      }
    }
    window._batchMetaPageInfo = _batchPageInfo;
    window._batchMetaPages    = Object.keys(_batchPageInfo).slice(0, 20);
    window._batchMetaType     = 'title';
    window._lastSiteData = { results, siteUrl };
    window._lastGraphData = graphNodes && graphLinks ? { nodes: graphNodes, links: graphLinks } : null;
    const checksWithFail = results.filter(r => r.fail.length > 0).length;
    const checksWarnOnly = results.filter(r => r.fail.length === 0 && r.warn.length > 0).length;
    const checksAllPass  = results.filter(r => r.fail.length === 0 && r.warn.length === 0).length;

    // Site health score: prefer server-computed value (avoids client/server rounding divergence)
    const clientScore = results.length ? Math.round(
      results.reduce((sum, r) => {
        const t = r.pass.length + r.warn.length + r.fail.length;
        return sum + (t ? (r.pass.length + r.warn.length * 0.5) / t * 100 : 100);
      }, 0) / results.length
    ) : 0;
    const siteScore = serverScore ?? clientScore;
    const grade  = serverGrade ?? letterGrade(siteScore);
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
          ${_currentSiteReportId ? `<a class="pdf-link" href="/report/${_currentSiteReportId}" target="_blank">
            <svg viewBox="0 0 24 24"><path d="M13 3L4 14h7v7l9-11h-7V3z"/></svg>
            Open Saved Report →
          </a>` : ''}
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
          ${window._sgPlan !== 'free' && window._batchMetaPages && window._batchMetaPages.length > 0 ? `
          <button class="pdf-link batch-meta-toggle-btn" style="background:none;cursor:pointer" onclick="openBatchMetaPanel()">
            <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
            Batch Meta Generate
          </button>` : ''}
        </div>`;

    // Batch Meta Generation panel (Pro+, only when there are affected pages)
    if (window._sgPlan !== 'free' && window._batchMetaPages && window._batchMetaPages.length > 0) {
      html += `
        <div id="batchMetaSection" class="batch-meta-section" style="display:none">
          <div class="batch-meta-header">
            <div class="batch-meta-title">✦ Batch AI Meta Generation</div>
            <div class="batch-meta-subtitle">${window._batchMetaPages.length} page${window._batchMetaPages.length !== 1 ? 's' : ''} with title or meta description issues. Select pages and generate AI-optimized suggestions.</div>
          </div>
          <div class="batch-meta-controls">
            <span style="color:var(--muted);font-family:'Space Mono',monospace;font-size:11px">Generate:</span>
            <button class="batch-type-btn active" id="batchTypeTitleBtn" onclick="setBatchType('title')">Title Tags</button>
            <button class="batch-type-btn" id="batchTypeDescBtn" onclick="setBatchType('description')">Meta Descriptions</button>
          </div>
          <table class="batch-meta-table">
            <thead><tr>
              <th style="width:28px"><input type="checkbox" id="batchSelectAll" onchange="batchToggleAll(this)" checked></th>
              <th>Page</th>
              <th>Issues</th>
            </tr></thead>
            <tbody id="batchMetaTbody"></tbody>
          </table>
          <div class="batch-meta-actions">
            <button class="batch-gen-btn" id="batchGenBtn" onclick="_runBatchMeta()">✦ Generate for selected (<span id="batchSelCount">0</span>)</button>
          </div>
          <div id="batchMetaResults"></div>
        </div>`;
    }

    // AI Executive Summary (pro/agency)
    if (aiSummary) {
      html += _renderExecSummaryCard(aiSummary, 'aiSummaryCard');
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
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;width:100%;box-sizing:border-box">
              <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:48px;flex-shrink:0;text-align:right">Depth ${d}</div>
              <div style="flex:1;min-width:0;height:8px;background:var(--border);border-radius:2px">
                <div style="height:100%;width:${barPct}%;background:${depthColor};border-radius:2px"></div>
              </div>
              <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:32px;flex-shrink:0">${count}</div>
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
          return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;width:100%;box-sizing:border-box">
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);min-width:80px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">/${esc(seg)}</div>
            <div style="flex:1;min-width:0;height:8px;background:var(--border);border-radius:2px">
              <div style="height:100%;width:${barPct}%;background:var(--accent);border-radius:2px"></div>
            </div>
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:32px;flex-shrink:0;text-align:right">${count}</div>
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
          return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;width:100%;box-sizing:border-box">
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);min-width:100px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(u)}">${esc(display)}</div>
            <div style="flex:1;min-width:0;height:8px;background:var(--border);border-radius:2px">
              <div style="height:100%;width:${barPct}%;background:var(--accent);border-radius:2px"></div>
            </div>
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);width:32px;flex-shrink:0">${inbound}</div>
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
          return `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-family:'Space Mono',monospace;font-size:11px">
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)" title="${esc(s.url)}">${esc(shortUrl)}</span>
            <span style="color:${msColor};white-space:nowrap">${s.ms}ms</span>
          </div>`;
        }).join('');
        html += `<div class="site-arch-panel">
          <div class="site-arch-panel-title">Response Time (TTFB)</div>
          <div style="display:flex;gap:24px;margin-bottom:8px">
            <div><div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${avgColor}">${avgMs}ms</div><div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);margin-top:2px">avg</div></div>
            <div><div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${p95Color}">${p95Ms}ms</div><div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);margin-top:2px">p95</div></div>
          </div>
          ${slowestRows ? `<div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-top:10px;margin-bottom:4px">Slowest Pages</div>${slowestRows}` : ''}
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
        <div id="siteGraphTooltip" style="position:fixed;background:#111214;border:1px solid #1e2025;border-radius:4px;padding:6px 10px;font-family:'Space Mono',monospace;font-size:11px;color:#e4e6ea;pointer-events:none;display:none;z-index:999;max-width:320px;word-break:break-all"></div>
      </div>`;
    }

    // Top Issues summary
    if (topIssues.length) {
      html += `<div class="detail-label" id="siteTopIssuesLabel">Top Issues</div><div class="result-rows" id="siteTopIssues">`;
      const topIssueCatMap = { technical: '#8892a4', content: '#e8a87c', aeo: '#7baeff', geo: '#b07bff' };
      topIssues.forEach((r, i) => {
        const cat = resultCategory(r.name);
        const displayName = stripAuditPrefix(r.name);
        html += `
          <div class="result-row">
            <div class="row-inner">
              <div class="row-header">
                <div class="row-name"><span style="color:${topIssueCatMap[cat]};font-size:10px;font-family:'Space Mono',monospace;letter-spacing:0.04em;margin-right:4px">[${CAT_LABELS[cat].short}]</span>${esc(displayName)}</div>
                <div class="row-score-right">
                  <div class="row-score-val fail">${pct(r.fail.length)}% <span style="font-size:9px;font-weight:400;color:var(--muted)">of pages</span></div>
                </div>
              </div>
              ${r.message ? `<div class="row-msg">${esc(r.message)}</div>` : ''}
              ${r.recommendation ? `
                <button class="rec-btn" onclick="toggleSiteRec('top${i}')">+ recommendation</button>
                <div class="row-rec" id="siteRectop${i}">${esc(r.recommendation)}</div>` : ''}
              <div class="row-footer">
                <span class="row-status fail">${statusIcon('fail')}</span>
              </div>
            </div>
          </div>`;
      });
      html += `</div>`;
    }

    // Issue Breakdown grouped by category (capped at 15 in live view; full list in saved report)
    const issueResults = sorted.filter(r => r.fail.length > 0 || r.warn.length > 0);
    const LIVE_ISSUE_CAP = 15;
    const isLiveView = !!_currentSiteReportId;
    const cappedIssues = isLiveView ? issueResults.slice(0, LIVE_ISSUE_CAP) : issueResults;
    const hiddenIssueCount = issueResults.length - cappedIssues.length;
    if (cappedIssues.length) {
      html += `<div class="detail-label" id="siteBreakdownLabel" style="margin-top:32px">Issue Breakdown</div><div class="result-rows" id="siteBreakdown">`;
      let lastCat = null;
      cappedIssues.forEach((r, i) => {
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
        const issueCatMap = { technical: '#8892a4', content: '#e8a87c', aeo: '#7baeff', geo: '#b07bff' };
        html += `
          <div class="result-row">
            <div class="row-inner">
              <div class="row-header">
                <div class="row-name"><span style="color:${issueCatMap[cat]};font-size:10px;font-family:'Space Mono',monospace;letter-spacing:0.04em;margin-right:4px">[${CAT_LABELS[cat].short}]</span>${esc(displayName)}</div>
                <div class="row-score-right">
                  <div class="${r.fail.length > 0 ? 'site-count-fail' : 'site-count-warn'}">${r.fail.length > 0 ? r.fail.length : r.warn.length}/${pageCount} <span style="font-size:9px;font-weight:400">(${r.fail.length > 0 ? pct(r.fail.length) : pct(r.warn.length)}%)</span>${r.fail.length > 0 && r.warn.length > 0 ? `<span class="site-count-warn" style="font-size:9px;margin-left:4px">+${r.warn.length}w</span>` : ''}</div>
                </div>
              </div>
              ${r.message ? `<div class="row-msg">${esc(r.message)}</div>` : ''}
              ${r.recommendation ? `
                <button class="rec-btn" onclick="toggleSiteRec('issue${i}')">+ recommendation</button>
                <div class="row-rec" id="siteRecissue${i}">${esc(r.recommendation)}</div>` : ''}
              <button class="rec-btn" id="siteRowBtn${i}" data-total="${totalAffected}" onclick="toggleSiteRow(${i})">+ ${totalAffected} page${totalAffected !== 1 ? 's' : ''} affected</button>
              <div class="site-issue-urls" id="siteRow${i}">
                ${affectedUrls.map(u => `<div>${esc(u)}</div>`).join('')}
                ${moreCount > 0 ? `<div style="font-style:italic">…and ${moreCount} more</div>` : ''}
              </div>
              ${r.fail.length > 0 ? `<button class="rec-btn generate-btn site-ai-fix-btn"
                data-check-name="${esc(r.name)}"
                data-fail-count="${r.fail.length}"
                data-page-count="${pageCount}"
                data-sample-urls="${esc(JSON.stringify(r.fail.slice(0, 3)))}"
                data-message="${esc(r.message || '')}"
                onclick="aiSiteFixRecFromBtn(this)">AI Fix →</button>` : ''}
              <div class="site-stacked-bar">
                <div class="site-stacked-seg" style="width:${pctFail}%;background:#ff4455"></div>
                <div class="site-stacked-seg" style="width:${pctWarn}%;background:#ffb800"></div>
                <div class="site-stacked-seg" style="width:${pctPass}%;background:#34d399"></div>
              </div>
              <div class="row-footer">
                <span class="row-status ${worstStatus}">${statusIcon(worstStatus)}</span>
              </div>
            </div>
          </div>`;
      });
      html += `</div>`;
      if (hiddenIssueCount > 0) {
        html += `<div style="text-align:center;margin:16px 0 32px">
          ${_currentSiteReportId
            ? `<a href="/report/${_currentSiteReportId}" target="_blank" style="font-family:'Space Mono',monospace;font-size:12px;color:var(--accent);text-decoration:none">+ ${hiddenIssueCount} more checks in saved report →</a>`
            : `<span style="font-family:'Space Mono',monospace;font-size:12px;color:var(--muted)">+ ${hiddenIssueCount} more checks — sign in to save full report</span>`
          }
        </div>`;
      }
    }

    // What's Working — summary line in live view, full collapsible list in saved report
    const passingChecks = sorted.filter(r => r.fail.length === 0 && r.warn.length === 0);
    if (passingChecks.length) {
      if (isLiveView) {
        html += `<div style="text-align:center;margin:8px 0 40px;font-family:'Space Mono',monospace;font-size:12px;color:var(--muted)">
          ✓ ${passingChecks.length} checks passing — <a href="/report/${_currentSiteReportId}" target="_blank" style="font-family:'Space Mono',monospace;color:var(--accent);text-decoration:none">view in saved report →</a>
        </div>`;
      } else {
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
          const workingCatMap = { technical: '#8892a4', content: '#e8a87c', aeo: '#7baeff', geo: '#b07bff' };
          html += `
            <div class="result-row">
              <div class="row-inner">
                <div class="row-header">
                  <div class="row-name"><span style="color:${workingCatMap[cat]};font-size:10px;font-family:'Space Mono',monospace;letter-spacing:0.04em;margin-right:4px">[${CAT_LABELS[cat].short}]</span>${esc(displayName)}</div>
                  <div class="row-score-right">
                    <span class="site-count-pass">${r.pass.length}/${pageCount}</span>
                  </div>
                </div>
                <div class="site-stacked-bar">
                  <div class="site-stacked-seg" style="width:100%;background:#34d399"></div>
                </div>
                <div class="row-footer">
                  <span class="row-status pass">${statusIcon('pass')}</span>
                </div>
              </div>
            </div>`;
        });
        html += `</div></div>`;
      }
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

  /* ── Batch Meta Generation ── */
  let _batchMetaPanelPopulated = false;

  function openBatchMetaPanel() {
    const sec = document.getElementById('batchMetaSection');
    if (!sec) return;
    const isVisible = sec.style.display !== 'none';
    sec.style.display = isVisible ? 'none' : 'block';
    if (!isVisible && !_batchMetaPanelPopulated) {
      _populateBatchMetaTbody();
      _batchMetaPanelPopulated = true;
    }
  }

  function _populateBatchMetaTbody() {
    const tbody = document.getElementById('batchMetaTbody');
    if (!tbody) return;
    const pages = window._batchMetaPages || [];
    const info  = window._batchMetaPageInfo || {};
    tbody.innerHTML = pages.map(u => {
      const d = info[u] || {};
      let path = u; try { path = new URL(u).pathname || '/'; } catch {}
      const badges = [
        d.titleIssue ? `<span class="batch-issue-badge batch-issue-title">Title</span>` : '',
        d.descIssue  ? `<span class="batch-issue-badge batch-issue-desc">Meta Desc</span>` : '',
      ].filter(Boolean).join('');
      return `<tr>
        <td><input type="checkbox" class="batch-url-check" value="${esc(u)}" checked onchange="batchUpdateSel()"></td>
        <td class="batch-url-cell" title="${esc(u)}">${esc(path)}</td>
        <td>${badges}</td>
      </tr>`;
    }).join('');
    batchUpdateSel();
  }

  function batchUpdateSel() {
    const checked = document.querySelectorAll('.batch-url-check:checked').length;
    const total   = document.querySelectorAll('.batch-url-check').length;
    const el = document.getElementById('batchSelCount');
    if (el) el.textContent = checked;
    const allCb = document.getElementById('batchSelectAll');
    if (allCb) allCb.checked = checked === total && total > 0;
    const btn = document.getElementById('batchGenBtn');
    if (btn) btn.disabled = checked === 0;
  }

  function batchToggleAll(cb) {
    document.querySelectorAll('.batch-url-check').forEach(c => { c.checked = cb.checked; });
    batchUpdateSel();
  }

  function setBatchType(type) {
    window._batchMetaType = type;
    document.getElementById('batchTypeTitleBtn')?.classList.toggle('active', type === 'title');
    document.getElementById('batchTypeDescBtn')?.classList.toggle('active', type === 'description');
  }

  async function _runBatchMeta() {
    const btn  = document.getElementById('batchGenBtn');
    const urls = [...document.querySelectorAll('.batch-url-check:checked')].map(c => c.value);
    if (!urls.length) return;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Generating…'; }
    const resultsDiv = document.getElementById('batchMetaResults');
    if (resultsDiv) resultsDiv.innerHTML = '<div class="batch-meta-loading">Fetching pages and generating suggestions…</div>';

    try {
      const resp = await fetch('/api/batch-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, type: window._batchMetaType || 'title' }),
      });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).message || resp.statusText);
      const data = await resp.json();
      if (!resultsDiv) return;
      const type = window._batchMetaType || 'title';
      const ANGLES = type === 'title'
        ? ['Benefit-led', 'Keyword-led', 'Question-led']
        : ['Direct', 'Inviting', 'Urgency-focused'];
      let html = '<div class="batch-results-grid">';
      for (const item of data.results) {
        let path = item.url; try { path = new URL(item.url).pathname || '/'; } catch {}
        html += `<div class="batch-result-card">
          <div class="batch-result-url" title="${esc(item.url)}">${esc(path)}</div>`;
        if (item.error || !item.variations) {
          html += `<div class="batch-result-error">Failed to generate — try again</div>`;
        } else {
          item.variations.forEach((v, i) => {
            const charColor = v.length > (type === 'title' ? 60 : 155) ? 'var(--warn)' : 'var(--muted)';
            html += `<div class="batch-variation">
              <span class="batch-var-label">${ANGLES[i] || `Option ${i + 1}`}</span>
              <span class="batch-var-text">${esc(v)}</span>
              <span class="batch-var-chars" style="color:${charColor}">${v.length}ch</span>
              <button class="batch-copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(v)}).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1200)})">Copy</button>
            </div>`;
          });
        }
        html += `</div>`;
      }
      html += '</div>';
      resultsDiv.innerHTML = html;
    } catch (err) {
      if (resultsDiv) resultsDiv.innerHTML = `<div class="batch-result-error">${esc(err.message)}</div>`;
    } finally {
      if (btn) {
        btn.disabled = false;
        const count = document.querySelectorAll('.batch-url-check:checked').length;
        btn.innerHTML = `✦ Generate for selected (<span id="batchSelCount">${count}</span>)`;
      }
    }
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
    container.innerHTML = '<div style="padding:16px;font-family:\'Space Mono\',monospace;color:var(--muted);font-size:12px">Building graph…</div>';

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

    if (!nodes.length) {
      container.innerHTML = '<div style="padding:32px;text-align:center;font-family:\'Space Mono\',monospace;font-size:12px;color:var(--muted)">No graph data available.</div>';
      return;
    }

    // ── Build adjacency + BFS depth from root ──────────────────────────────
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const outAdj   = new Map(nodes.map(n => [n.id, []]));
    const validLinks = [];
    for (const l of links) {
      if (nodeById.has(l.source) && nodeById.has(l.target) && l.source !== l.target) {
        outAdj.get(l.source).push(l.target);
        validLinks.push(l);
      }
    }

    // Root = most inbound links (usually the homepage)
    const root = [...nodes].sort((a, b) => b.inbound - a.inbound)[0];

    const depthMap  = new Map();
    const parentMap = new Map();
    depthMap.set(root.id, 0);
    const queue = [root.id];
    while (queue.length) {
      const curr = queue.shift();
      for (const next of outAdj.get(curr) || []) {
        if (!depthMap.has(next)) {
          depthMap.set(next, depthMap.get(curr) + 1);
          parentMap.set(next, curr);
          queue.push(next);
        }
      }
    }
    // Nodes unreachable from root → put at max+1
    const maxDepth = Math.max(...depthMap.values(), 1);
    for (const n of nodes) { if (!depthMap.has(n.id)) depthMap.set(n.id, maxDepth + 1); }

    // ── Select top nodes per depth (cap total at 120) ─────────────────────
    const MAX_TOTAL = 120;
    const byDepth   = new Map();
    for (const n of nodes) {
      const d = depthMap.get(n.id);
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d).push(n);
    }
    const depthKeys = [...byDepth.keys()].sort((a, b) => a - b);

    const selected = new Set([root.id]);
    let budget = MAX_TOTAL - 1;
    // Distribute budget proportionally across depths (deeper = fewer slots)
    for (const d of depthKeys) {
      if (d === 0 || budget <= 0) continue;
      const bucket = byDepth.get(d).sort((a, b) => b.inbound - a.inbound);
      const take   = Math.min(bucket.length, Math.ceil(budget / Math.max(1, depthKeys.length - 1)));
      for (let i = 0; i < take && budget > 0; i++) { selected.add(bucket[i].id); budget--; }
    }

    // ── Assign radial positions ────────────────────────────────────────────
    const W  = container.clientWidth  || 640;
    const H  = container.clientHeight || 480;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(cx, cy) * 0.86;

    // Rebuild per-depth list of selected nodes only
    const selByDepth = new Map();
    for (const id of selected) {
      const d = depthMap.get(id);
      if (!selByDepth.has(d)) selByDepth.set(d, []);
      selByDepth.get(d).push(id);
    }
    const usedDepths = [...selByDepth.keys()].sort((a, b) => a - b);
    const numRings   = usedDepths[usedDepths.length - 1] || 1;

    const posMap = new Map();
    posMap.set(root.id, { x: cx, y: cy });

    for (const d of usedDepths) {
      if (d === 0) continue;
      const ids = selByDepth.get(d);
      // Sort within ring by parent angle to minimize edge crossings
      ids.sort((a, b) => {
        const pA = posMap.get(parentMap.get(a));
        const pB = posMap.get(parentMap.get(b));
        if (!pA || !pB) return 0;
        return Math.atan2(pA.y - cy, pA.x - cx) - Math.atan2(pB.y - cy, pB.x - cx);
      });
      const r = (d / numRings) * maxR;
      ids.forEach((id, i) => {
        const angle = (i / ids.length) * 2 * Math.PI - Math.PI / 2;
        posMap.set(id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
      });
    }

    // ── Render ─────────────────────────────────────────────────────────────
    container.innerHTML = '';
    const svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
    const g   = svg.append('g');

    const zoom = d3.zoom().scaleExtent([0.15, 6]).on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    _d3ZoomBehavior = zoom;
    _d3Svg = svg;

    // Depth ring guides
    for (const d of usedDepths) {
      if (d === 0) continue;
      const r = (d / numRings) * maxR;
      g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r)
        .attr('fill', 'none').attr('stroke', '#1e2025').attr('stroke-width', 1).attr('stroke-dasharray', '3,6');
      g.append('text').attr('x', cx + r + 4).attr('y', cy + 10)
        .attr('font-family', "'Space Mono',monospace").attr('font-size', 9).attr('fill', '#2a2d35')
        .text(`D${d}`);
    }

    // Links (only between selected nodes)
    const drawnLinks = validLinks.filter(l => selected.has(l.source) && selected.has(l.target));
    const linkSel = g.append('g').selectAll('line').data(drawnLinks).join('line')
      .attr('x1', d => posMap.get(d.source)?.x ?? cx)
      .attr('y1', d => posMap.get(d.source)?.y ?? cy)
      .attr('x2', d => posMap.get(d.target)?.x ?? cx)
      .attr('y2', d => posMap.get(d.target)?.y ?? cy)
      .attr('stroke', '#2a2d35').attr('stroke-width', 0.8).attr('stroke-opacity', 0.55);

    // Nodes
    const shownNodes  = nodes.filter(n => posMap.has(n.id));
    const maxInbound  = Math.max(1, ...shownNodes.map(n => n.inbound));
    const nodeColor   = n => n.id === root.id ? '#4d9fff' : n.fails > 3 ? '#ff4455' : n.fails > 0 ? '#ffb800' : '#34d399';
    const nodeRadius  = n => n.id === root.id ? 9 : 4 + Math.round((n.inbound / maxInbound) * 5);

    const nodeSel = g.append('g').selectAll('circle').data(shownNodes).join('circle')
      .attr('cx', d => posMap.get(d.id).x)
      .attr('cy', d => posMap.get(d.id).y)
      .attr('r',  d => nodeRadius(d))
      .attr('fill',         d => nodeColor(d))
      .attr('stroke',       '#0b0c0e')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', (e, d) => {
        const tip  = document.getElementById('siteGraphTooltip');
        const path = d.id.replace(/^https?:\/\/[^/]+/, '') || '/';
        const depthLabel = `Depth ${depthMap.get(d.id)}`;
        const failLabel  = d.fails > 0 ? `<span style="color:var(--fail)">${d.fails} fail${d.fails>1?'s':''}</span>` : '<span style="color:var(--pass)">Healthy</span>';
        if (tip) {
          tip.style.display = 'block';
          tip.style.left    = (e.clientX + 14) + 'px';
          tip.style.top     = (e.clientY - 10) + 'px';
          tip.innerHTML     = `<div style="margin-bottom:3px;color:#e4e6ea">${esc(path)}</div><div style="font-size:10px;color:#8892a4">${depthLabel} · ${d.inbound} inbound · ${failLabel}</div>`;
        }
      })
      .on('mousemove', e => {
        const tip = document.getElementById('siteGraphTooltip');
        if (tip) { tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; }
      })
      .on('mouseout', () => {
        const tip = document.getElementById('siteGraphTooltip');
        if (tip) tip.style.display = 'none';
      })
      .on('click', (e, d) => {
        const neighborIds = new Set(drawnLinks.filter(l =>
          l.source === d.id || l.target === d.id
        ).flatMap(l => [l.source, l.target]));
        nodeSel.attr('opacity', n => neighborIds.has(n.id) ? 1 : 0.15);
        linkSel.attr('opacity', l => (l.source === d.id || l.target === d.id) ? 0.9 : 0.05);
        e.stopPropagation();
      });

    svg.on('click', () => { nodeSel.attr('opacity', 1); linkSel.attr('opacity', 0.55); });

    // Fixed legend (outside zoomable g — stays in place during pan/zoom)
    const hiddenCount = nodes.length - selected.size;
    const legendOverlay = svg.append('g').attr('class', 'graph-legend');
    if (hiddenCount > 0) {
      legendOverlay.append('text').attr('x', 8).attr('y', H - 22)
        .attr('font-family', "'Space Mono',monospace").attr('font-size', 10).attr('fill', '#3a3f4a')
        .text(`+${hiddenCount} pages not shown (top ${MAX_TOTAL} by inbound)`);
    }
    [['#4d9fff','Root'],['#34d399','Healthy'],['#ffb800','Issues'],['#ff4455','Critical']].forEach(([c, label], i) => {
      const lx = 8 + i * 90;
      const ly = H - 8;
      legendOverlay.append('circle').attr('cx', lx).attr('cy', ly - 4).attr('r', 5).attr('fill', c).attr('stroke', '#0b0c0e').attr('stroke-width', 1.5);
      legendOverlay.append('text').attr('x', lx + 9).attr('y', ly)
        .attr('font-family', "'Space Mono',monospace").attr('font-size', 10).attr('fill', '#8892a4')
        .text(label);
    });
  }

  /* ── Page audit result filter ── */
  let _activeStatus = 'all';
  let _activeCat    = 'all';

  /* ── Fix Tracker ── */
  let _fixStatuses = {}; // checkName → 'todo' | 'in_progress' | 'fixed'
  const FIX_NEXT   = { todo: 'fixed', in_progress: 'fixed', fixed: 'todo' };
  const FIX_LABEL  = { todo: '○ Mark', in_progress: '○ Mark', fixed: '✓ Done' };
  const FIX_COLOR  = { todo: 'var(--muted)', in_progress: 'var(--muted)', fixed: 'var(--pass)' };

  function applyPageFilter(btn, type) {
    if (type === 'status') {
      _activeStatus = btn.dataset.status;
      document.querySelectorAll('#resultFilterBar .rfb-btn').forEach(b => b.classList.remove('active'));
    } else {
      _activeCat = btn.dataset.cat;
      document.querySelectorAll('#resultFilterBar .rfb-pill').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');

    // Filter detail rows
    document.querySelectorAll('#resultRows .result-row').forEach(row => {
      const statusEl = row.querySelector('.row-status');
      const nameEl   = row.querySelector('.row-name');
      if (!statusEl || !nameEl) return;
      const status = statusEl.classList.contains('fail') ? 'fail' : statusEl.classList.contains('warn') ? 'warn' : 'pass';
      const cat = row.dataset.cat || resultCategory(nameEl.textContent || '');
      const statusOk = _activeStatus === 'all' || status === _activeStatus;
      const catOk    = _activeCat === 'all' || cat === _activeCat;
      row.style.display = (statusOk && catOk) ? '' : 'none';
    });
    // Hide category headers that have no visible rows below them
    document.querySelectorAll('#resultRows .detail-cat-header').forEach(header => {
      let next = header.nextElementSibling;
      let anyVisible = false;
      while (next && !next.classList.contains('detail-cat-header')) {
        if (next.style.display !== 'none') { anyVisible = true; break; }
        next = next.nextElementSibling;
      }
      header.style.display = anyVisible ? '' : 'none';
    });
    // Filter matrix items
    document.querySelectorAll('#matrixView .matrix-item').forEach(item => {
      const status = item.classList.contains('fail') ? 'fail' : item.classList.contains('warn') ? 'warn' : 'pass';
      const cat = item.dataset.cat || 'technical';
      const statusOk = _activeStatus === 'all' || status === _activeStatus;
      const catOk    = _activeCat === 'all' || cat === _activeCat;
      item.style.display = (statusOk && catOk) ? '' : 'none';
    });
    // Hide matrix cells with no visible items
    document.querySelectorAll('#matrixView .matrix-cell').forEach(cell => {
      const items = cell.querySelectorAll('.matrix-item');
      const anyVisible = Array.from(items).some(i => i.style.display !== 'none');
      const emptyMsg = cell.querySelector('.matrix-cell-empty');
      if (emptyMsg) return; // static empty cell, leave alone
      if (items.length) {
        let placeholder = cell.querySelector('.matrix-filter-empty');
        if (!anyVisible) {
          if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'matrix-cell-empty matrix-filter-empty';
            placeholder.textContent = 'None match filter';
            cell.appendChild(placeholder);
          }
          placeholder.style.display = '';
        } else if (placeholder) {
          placeholder.style.display = 'none';
        }
      }
    });
    // Filter card strip
    document.querySelectorAll('#cardStrip .audit-card').forEach(card => {
      const statusOk = _activeStatus === 'all' || card.classList.contains(_activeStatus);
      const nameEl   = card.querySelector('.card-name');
      const cat = nameEl ? resultCategory('[' + (nameEl.textContent || '').trim()) : 'technical';
      // cards have stripped names, need to infer cat from strip separators
      // Use a simpler approach: store data-cat on card during render
      const cardCat = card.dataset.cat || 'technical';
      const catOk   = _activeCat === 'all' || cardCat === _activeCat;
      card.style.display = (statusOk && catOk) ? '' : 'none';
    });
  }

  /* ── Score Target Roadmap ── */
  function renderScoreRoadmap(results, currentScore, targetScore) {
    const el = document.getElementById('scoreRoadmapList');
    if (!el) return;
    targetScore = parseInt(targetScore, 10);
    if (currentScore >= targetScore) {
      el.innerHTML = `<div style="font-family:'Space Mono',monospace;color:var(--pass);font-size:12px">You're already at or above this target.</div>`;
      return;
    }
    const totalChecks = results.length;
    if (!totalChecks) return;
    const pointsPerCheck = 100 / totalChecks;
    const needed = targetScore - currentScore;
    // Sort non-pass checks by normalizedScore ascending (most improvement potential first)
    const nonPass = results
      .filter(r => r.status !== 'pass')
      .map(r => ({ ...r, normalizedScore: r.normalizedScore ?? (r.status === 'warn' ? 50 : 0) }))
      .sort((a, b) => a.normalizedScore - b.normalizedScore);
    let accumulated = 0;
    const roadmap = [];
    for (const r of nonPass) {
      if (accumulated >= needed) break;
      const gain = pointsPerCheck * (1 - r.normalizedScore / 100);
      accumulated += gain;
      roadmap.push({ name: r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, ''), fullName: r.name, status: r.status, gain });
    }
    const catLabel = n => {
      const m = n.match(/^\[(Technical|Content|AEO|GEO)\]/);
      return m ? m[1] : 'Technical';
    };
    const catColor = c => ({ Technical:'#8892a4', Content:'#e8a87c', AEO:'#7baeff', GEO:'#b07bff' })[c] || '#8892a4';
    const showFix = ((_currentUser && (_currentUser.plan === 'pro' || _currentUser.plan === 'agency')) || window._sgPlan === 'pro' || window._sgPlan === 'agency') && !!_currentReportId;
    el.innerHTML = `
      <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);margin-bottom:10px">Fix these <strong style="color:var(--text)">${roadmap.length}</strong> item${roadmap.length===1?'':'s'} to reach <strong style="color:var(--text)">${targetScore}/100</strong>:</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${roadmap.map((r, i) => {
          const cat = catLabel(r.fullName);
          const col = catColor(cat);
          const statusDot = r.status === 'fail' ? 'var(--fail)' : 'var(--warn)';
          const curStatus = _fixStatuses[r.fullName] || 'todo';
          return `<div class="roadmap-item">
            <span class="roadmap-num">${i + 1}.</span>
            <span class="roadmap-dot" style="background:${statusDot}"></span>
            <span class="roadmap-cat" style="color:${col}">[${cat}]</span>
            <span class="roadmap-name">${esc(r.name)}</span>
            ${showFix ? `<button class="fix-status-btn roadmap-fix-btn" data-check="${esc(r.fullName)}" style="color:${FIX_COLOR[curStatus]}" onclick="cycleFixStatus(this)">${FIX_LABEL[curStatus]}</button>` : ''}
          </div>`;
        }).join('')}
      </div>
    `;
  }

  /* ── Fix Tracker ── */
  async function cycleFixStatus(btn) {
    const checkName = btn.dataset.check;
    if (!checkName) return;
    const current = _fixStatuses[checkName] || 'todo';
    const next    = FIX_NEXT[current];
    _fixStatuses[checkName] = next;
    // Sync all buttons sharing this check name (detail rows, matrix, roadmap)
    document.querySelectorAll(`.fix-status-btn[data-check="${CSS.escape(checkName)}"]`).forEach(b => {
      b.textContent = FIX_LABEL[next];
      b.style.color = FIX_COLOR[next];
    });
    // Update progress bar
    const bar   = document.getElementById('fixProgressBar');
    const label = document.getElementById('fixProgressLabel');
    if (bar && label) {
      const nonPassTotal = parseInt(bar.dataset.total || '0', 10);
      const fixed = Object.values(_fixStatuses).filter(s => s === 'fixed').length;
      bar.style.width = nonPassTotal ? (fixed / nonPassTotal * 100) + '%' : '0%';
      label.textContent = `${fixed} / ${nonPassTotal} issues resolved`;
    }
    // Persist to server
    if (_currentReportId) {
      try {
        await fetch(`/api/reports/${_currentReportId}/fixes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkName, status: next }),
        });
      } catch {}
    }
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
        // Show performance budget section for pro/agency users
        const perfBudgetSection = document.getElementById('perfBudgetSection');
        if (perfBudgetSection) perfBudgetSection.style.display = isPro ? 'block' : 'none';
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
        renderSiteResults({ pageCount: d.pageCount, results: d.results, siteUrl: d.url, pdfFile: d.pdfFile, depthDistribution: d.depthDistribution, dirCounts: d.dirCounts, linkEquity: d.linkEquity, responseStats: d.responseStats, aiSummary: d.aiSummary, linkOpportunities: d.linkOpportunities, graphNodes: d.graphNodes, graphLinks: d.graphLinks, siteScore: d.siteScore, siteGrade: d.siteGrade });
      } else if (d._replayType === 'multi') {
        renderMultiResults({ locations: d.locations, pdfFile: d.pdfFile, comparisonInsight: d.comparisonInsight ?? null }, null);
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

    // Handle ?compare=URL — pre-fill Compare mode (e.g. redirected from saved report page)
    const compareParam = new URLSearchParams(window.location.search).get('compare');
    if (compareParam) {
      setMode('multi');
      const rows = document.querySelectorAll('#multiInputWrap .multi-loc-url');
      if (rows[0]) rows[0].value = compareParam;
      addMultiRow();
      setTimeout(() => document.querySelectorAll('#multiInputWrap .multi-loc-url')[1]?.focus(), 50);
      // Clean up the URL without reloading
      history.replaceState(null, '', window.location.pathname);
    }
  }

  window._sgOnMount = _sgInit;
  _sgInit();
