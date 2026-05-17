<script setup>
useHead({
  title: 'SearchGrade — Search Visibility Audit',
  meta: [
    { name: 'description', content: 'Audit your site across 100+ checks covering Technical SEO, Content quality, AEO, and GEO signals. Free. PDF report included.' },
    { property: 'og:title', content: 'SearchGrade — Search Visibility Audit' },
    { property: 'og:description', content: 'Score your site across Google, and across AI. 100+ checks. Free PDF report.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://searchgrade.com/' },
    { property: 'og:image', content: 'https://searchgrade.com/og-image.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: 'https://searchgrade.com/og-image.png' },
  ],
  script: [{
    type: 'application/ld+json',
    children: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'SearchGrade',
      url: 'https://searchgrade.com',
      description: 'Search visibility audit tool covering Technical SEO, Content, AEO, and GEO signals.',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://searchgrade.com/?url={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    }),
  }],
})

onMounted(() => {
  if (typeof window._sgOnMount === 'function') {
    window._sgOnMount()
    return
  }
  // First load — inject script after Vue has rendered the DOM
  const s = document.createElement('script')
  s.src = '/app-main.js'
  document.body.appendChild(s)
})
</script>

<style scoped>
.meta-strip {
  max-width: 1080px;
  margin: 0 auto;
  padding: 9px 32px;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--muted);
  font-family: 'Space Mono', monospace;
  text-align: center;
}

</style>

<template>
  <AppNav>
    <AppNavAuth />
  </AppNav>
  <div class="meta-strip">
    <span class="cat-tag cat-technical">Technical</span>
    <span class="meta-dot">·</span>
    <span class="cat-tag cat-content">Content</span>
    <span class="meta-dot">·</span>
    <span class="cat-tag cat-aeo">AEO</span>
    <span class="meta-dot">·</span>
    <span class="cat-tag cat-geo">GEO</span>
    <span class="meta-dot">·</span>
    <span id="checkCount"></span> CHECKS · PDF OUTPUT
  </div>

  <div id="app">

    <!-- HERO -->
    <section class="hero">
      <div class="display-block">
        <div class="display-tag">Search Visibility Audit</div>
        <h1 class="display-heading">
          AUDIT YOUR<br>
          <span class="line2"><span class="acc">SEARCH</span></span><br>
          <span class="line2">VISIBILITY</span>
        </h1>
        <p class="display-tagline">Score your site across Google, and across AI.</p>

        <div class="input-area">
          <div class="mode-toggle">
            <button class="mode-btn active" id="modePageBtn" onclick="setMode('page')">Page Audit</button>
            <button class="mode-btn" id="modeSiteBtn" onclick="setMode('site')">Site Audit</button>
            <button class="mode-btn" id="modeMultiBtn" onclick="setMode('multi')">Compare</button>
            <button class="mode-btn" id="modeBulkBtn" onclick="setMode('bulk')">Bulk (Page)</button>
          </div>
          <div class="crawl-limit-note" id="crawlLimitNote" style="display:none">
            Up to 50 pages per crawl<span class="tier-badge">FREE</span>
          </div>

          <!-- Single URL input (Page + Site modes) -->
          <div id="singleInputWrap">
            <div class="input-descriptor">Target URL</div>
            <div class="input-row">
              <div class="input-prefix">$ audit</div>
              <input type="url" id="urlInput" placeholder="https://yoursite.com"
                     autocomplete="off" spellcheck="false" />
              <button id="auditBtn">Run →</button>
            </div>
          </div>

          <!-- Compare URL input (Compare mode) -->
          <div id="multiInputWrap" style="display:none">
            <div class="input-descriptor">Compare — Label (optional) + URL</div>
            <div id="multiLocRows"></div>
            <div style="max-width:720px;margin:0 auto;display:flex;justify-content:space-between;align-items:center">
              <button id="multiAddRowBtn" onclick="addMultiRow()">+ Add URL</button>
              <div class="multi-limit-note">Up to 10 URLs<span class="tier-badge" style="margin-left:8px">FREE</span></div>
            </div>
            <div class="input-row" style="margin-top:14px">
              <button id="multiAuditBtn" style="flex:1;padding:16px 28px">Run Comparison →</button>
            </div>
          </div>

          <!-- Bulk URL input -->
          <div id="bulkInputWrap" style="display:none">
            <div class="input-descriptor">Bulk Audit — one URL per line</div>
            <textarea id="bulkUrlInput"
              placeholder="https://example.com/page-1&#10;https://example.com/page-2&#10;https://example.com/page-3"
              rows="6"
              autocomplete="off" spellcheck="false"
              style="width:100%;max-width:720px;display:block;margin:0 auto 12px;background:var(--bg2);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:12px;padding:12px 14px;resize:vertical;box-sizing:border-box"></textarea>
            <div style="max-width:720px;margin:0 auto;display:flex;justify-content:space-between;align-items:center">
              <div class="multi-limit-note">Up to 10 URLs<span class="tier-badge" style="margin-left:8px">FREE</span></div>
              <button id="bulkAuditBtn" onclick="runBulkAudit()">Run Bulk Audit →</button>
            </div>
          </div>

          <!-- Crawl Settings (Site mode only) -->
          <div id="crawlSettingsRow" style="display:none;max-width:720px;margin:0 auto 8px">
            <button class="customize-toggle" id="crawlSettingsToggle" onclick="toggleCrawlSettings()">⚙ Crawl Settings</button>
            <div id="crawlSettingsPanel" style="display:none;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:16px 20px;margin-top:8px">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Max Depth</div>
                  <input type="number" id="crawlMaxDepth" value="10" min="1" max="20"
                    style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:12px;padding:7px 10px;border-radius:4px;box-sizing:border-box" />
                  <div style="font-size:11px;color:var(--muted);margin-top:4px">Levels deep from root (1–20)</div>
                </div>
                <div>
                  <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Crawl Delay (ms)</div>
                  <input type="number" id="crawlDelayMs" value="0" min="0" max="5000" step="100"
                    style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:12px;padding:7px 10px;border-radius:4px;box-sizing:border-box" />
                  <div style="font-size:11px;color:var(--muted);margin-top:4px">ms between pages (0 = fastest)</div>
                </div>
              </div>
              <div style="margin-top:14px">
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Exclude URL Patterns</div>
                <input type="text" id="crawlExcludePatterns" placeholder="/admin, /login, ?utm_, /tag/"
                  style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:12px;padding:7px 10px;border-radius:4px;box-sizing:border-box" />
                <div style="font-size:11px;color:var(--muted);margin-top:4px">Comma-separated path substrings to skip</div>
              </div>
              <div style="margin-top:12px">
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Include URL Patterns (optional)</div>
                <input type="text" id="crawlIncludePatterns" placeholder="/blog, /products"
                  style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:12px;padding:7px 10px;border-radius:4px;box-sizing:border-box" />
                <div style="font-size:11px;color:var(--muted);margin-top:4px">Only crawl URLs containing one of these — leave empty to crawl all</div>
              </div>
              <div style="margin-top:12px;display:flex;align-items:center;gap:10px">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                  <input type="checkbox" id="crawlSpellingCheck" style="accent-color:var(--accent);width:15px;height:15px" />
                  <span style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text)">Enable Spelling Check</span>
                </label>
                <span style="font-size:11px;color:var(--muted)">(slow: +~30s, checks first 10 pages)</span>
              </div>
            </div>
          </div>

          <div class="customize-row" id="customizeRow">
            <button class="customize-toggle" onclick="toggleCustomize()">+ Customize Report</button>
            <div class="customize-panel" id="customizePanel" style="display:none">
              <div class="input-descriptor">Agency Logo URL (optional)</div>
              <input type="url" id="logoUrlInput" class="logo-input"
                     placeholder="https://youragency.com/logo.png"
                     autocomplete="off" spellcheck="false" />
              <div style="margin-top:12px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);">
                <label id="jsRenderLabel" style="display:flex;align-items:center;gap:8px;cursor:pointer;opacity:0.45">
                  <input type="checkbox" id="jsRenderToggle" disabled />
                  <span>JS Rendering — headless browser fetch (React/Vue/Angular SPAs)</span>
                  <span class="tier-badge" style="margin-left:4px">PRO</span>
                </label>
                <span style="font-size:11px;color:var(--muted)">+5–15s</span>
              </div>
              <!-- Performance Budget (Pro+) -->
              <div id="perfBudgetSection" style="display:none;margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">
                  Performance Budget <span class="tier-badge" style="margin-left:4px">PRO</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                  <div>
                    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Max LCP (ms)</div>
                    <input type="number" id="budgetLcp" value="2500" min="500" max="10000" step="100"
                      style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:12px;padding:6px 10px;border-radius:4px;box-sizing:border-box" />
                  </div>
                  <div>
                    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Max TBT (ms)</div>
                    <input type="number" id="budgetTbt" value="200" min="50" max="5000" step="50"
                      style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:12px;padding:6px 10px;border-radius:4px;box-sizing:border-box" />
                  </div>
                  <div>
                    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Max JS size (KB)</div>
                    <input type="number" id="budgetJs" value="500" min="50" max="5000" step="50"
                      style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:12px;padding:6px 10px;border-radius:4px;box-sizing:border-box" />
                  </div>
                  <div>
                    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Max page weight (KB)</div>
                    <input type="number" id="budgetWeight" value="3000" min="100" max="20000" step="100"
                      style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:12px;padding:6px 10px;border-radius:4px;box-sizing:border-box" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="statusArea">
            <div id="statusLine" class="status-line" style="display:none">
              <span class="prompt-char">&gt;</span>
              <span id="statusText"></span>
              <span class="cursor"></span>
            </div>
            <div id="progressTrack" class="progress-track" style="display:none">
              <div id="progressFill" class="progress-fill"></div>
            </div>
            <div id="errorLine" class="status-line error-line" style="display:none">
              <span class="prompt-char">!</span>
              <span id="errorText"></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- RESULTS -->
    <section id="results">
      <hr class="results-divider" />
      <div id="resultsInner"></div>
    </section>

  </div>
</template>
