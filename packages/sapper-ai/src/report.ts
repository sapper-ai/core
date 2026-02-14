import type { ScanResult } from './scan'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function generateCss(): string {
  return `
:root, [data-theme="dark"] {
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #2a2a2a;
  --border: #333333;
  --text-primary: #f5f5f5;
  --text-secondary: #a0a0a0;
  --text-muted: #666666;
  --accent: #00d9ff;
  --accent-glow: rgba(0, 217, 255, 0.15);
  --risk-critical: #ef4444;
  --risk-high: #f59e0b;
  --risk-low: #22c55e;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
  --border: #e5e7eb;
  --text-primary: #0a0a0a;
  --text-secondary: #4b5563;
  --text-muted: #9ca3af;
  --accent: #0284c7;
  --accent-glow: rgba(2, 132, 199, 0.1);
}

* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
}

header {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.logo {
  font-weight: 700;
  letter-spacing: 0.2px;
}

.meta {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}

#theme-toggle {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
}

.container {
  padding: 18px 20px 28px;
  max-width: 1200px;
  margin: 0 auto;
}

.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
}

.metric-card .label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-card .value {
  display: block;
  margin-top: 6px;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.metric-card .value.danger { color: var(--risk-critical); }

.chart {
  margin-top: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
}

.chart-bars { display: flex; gap: 10px; align-items: flex-end; height: 48px; }
.bar {
  flex: 1;
  border-radius: 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.bar > span { position: absolute; inset: 0; display: block; }
.bar .critical { background: var(--risk-critical); }
.bar .high { background: var(--risk-high); }
.bar .clean { background: var(--risk-low); }
.chart-legend { display: flex; gap: 14px; margin-top: 10px; color: var(--text-secondary); font-size: 12px; }

.main {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 30% 70%;
  gap: 12px;
  min-height: 520px;
}

.panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}

.file-tree {
  display: flex;
  flex-direction: column;
}

.file-tree .controls {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

#tree-search {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.toggle {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

#tree {
  padding: 10px;
  overflow: auto;
  flex: 1;
}

details {
  border-radius: 10px;
}
summary {
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 10px;
  color: var(--text-primary);
}
summary:hover { background: var(--bg-tertiary); }

.file-btn {
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  border-radius: 10px;
  cursor: pointer;
}

.file-btn:hover { background: var(--bg-tertiary); }
.file-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent);
  border-left: 3px solid var(--accent);
}

.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot.critical { background: var(--risk-critical); }
.dot.high { background: var(--risk-high); }
.dot.clean { background: var(--risk-low); }

.detail-panel { display: flex; flex-direction: column; }
.detail-inner {
  padding: 14px;
  overflow: auto;
  flex: 1;
}

.file-header { padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.file-path { font-size: 12px; color: var(--text-secondary); word-break: break-all; }
.file-name { margin-top: 6px; font-size: 18px; font-weight: 700; }
.metrics { margin-top: 10px; display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--text-secondary); }
.badge { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); }
.badge.block { border-color: var(--risk-critical); color: var(--risk-critical); }
.badge.allow { border-color: var(--risk-low); color: var(--risk-low); }

.section { margin-top: 14px; }
.section h3 { margin: 0 0 8px; font-size: 13px; color: var(--text-secondary); }
.patterns ul { margin: 0; padding-left: 18px; }

pre {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  overflow: auto;
}
code {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  color: var(--text-primary);
  white-space: pre;
}

@media (max-width: 1024px) {
  .main { grid-template-columns: 40% 60%; }
}

@media (max-width: 768px) {
  header { height: auto; padding: 12px 14px; gap: 10px; flex-wrap: wrap; }
  .container { padding: 14px; }
  .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .main { grid-template-columns: 1fr; }
  #tree { max-height: 260px; }
}

@media print {
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  header { position: static; }
  .main { grid-template-columns: 1fr; }
}
`.trim()
}

function generateJs(): string {
  return `
const el = (sel) => document.querySelector(sel);

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function riskLevel(risk) {
  if (risk >= 0.8) return 'critical';
  if (risk >= 0.5) return 'high';
  return 'clean';
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function buildFileTree(findings) {
  const root = { files: [], dirs: new Map() };
  for (const f of findings) {
    const parts = String(f.filePath).split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      if (isFile) {
        node.files.push(f);
      } else {
        if (!node.dirs.has(part)) {
          node.dirs.set(part, { name: part, files: [], dirs: new Map() });
        }
        node = node.dirs.get(part);
      }
    }
  }
  return root;
}

function renderTreeNode(node, opts) {
  const container = document.createElement('div');

  const dirEntries = Array.from(node.dirs.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const dir of dirEntries) {
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = dir.name;
    details.appendChild(summary);
    details.appendChild(renderTreeNode(dir, opts));
    container.appendChild(details);
  }

  const files = node.files.slice().sort((a, b) => String(a.filePath).localeCompare(String(b.filePath)));
  for (const f of files) {
    const threat = Number(f.risk) >= 0.5;
    if (opts.threatsOnly && !threat) continue;
    if (opts.query) {
      const name = String(f.filePath).split('/').pop() || '';
      if (!name.toLowerCase().includes(opts.query.toLowerCase())) continue;
    }

    const btn = document.createElement('button');
    btn.className = 'file-btn';
    btn.type = 'button';
    btn.setAttribute('data-file', String(f.filePath));
    btn.setAttribute('role', 'treeitem');
    btn.tabIndex = -1;

    const dot = document.createElement('span');
    dot.className = 'dot ' + riskLevel(Number(f.risk));
    btn.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = String(f.filePath).split('/').pop() || String(f.filePath);
    btn.appendChild(label);

    btn.addEventListener('click', () => handleFileClick(String(f.filePath)));
    container.appendChild(btn);
  }

  return container;
}

function handleFileClick(filePath) {
  const finding = (SCAN_DATA.findings || []).find((f) => f.filePath === filePath);
  if (!finding) return;

  document.querySelectorAll('.file-btn').forEach((b) => b.classList.remove('active'));
  const active = document.querySelector('.file-btn[data-file="' + CSS.escape(filePath) + '"]');
  if (active) active.classList.add('active');

  const detail = el('#detail');
  const name = String(filePath).split('/').pop() || filePath;
  const patterns = Array.isArray(finding.patterns) ? finding.patterns : [];
  const detectors = Array.isArray(finding.detectors) ? finding.detectors : [];
  const badgeClass = finding.action === 'block' ? 'block' : 'allow';
  const badgeText = String(finding.action || '').toUpperCase();

  const patternsHtml = patterns.length
    ? patterns.map((p) => '<li>' + escapeHtml(p) + '</li>').join('')
    : '<li>None</li>';
  const detectorsHtml = detectors.length
    ? detectors.map((d) => '<span class="badge">' + escapeHtml(d) + '</span>').join('')
    : '<span class="badge">none</span>';

  detail.innerHTML =
    '<div class="detail-inner">' +
      '<div class="file-header">' +
        '<div class="file-path">' + escapeHtml(filePath) + '</div>' +
        '<div class="file-name">' + escapeHtml(name) + '</div>' +
        '<div class="metrics">' +
          '<span>Risk: <span class="badge">' + Number(finding.risk).toFixed(2) + '</span></span>' +
          '<span>Confidence: <span class="badge">' + Math.round(Number(finding.confidence) * 100) + '%</span></span>' +
          '<span class="badge ' + badgeClass + '">' + escapeHtml(badgeText) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="section patterns">' +
        '<h3>Detected Patterns</h3>' +
        '<ul>' + patternsHtml + '</ul>' +
      '</div>' +
      '<div class="section snippet">' +
        '<h3>Code Snippet</h3>' +
        '<pre><code>' + escapeHtml(finding.snippet || '') + '</code></pre>' +
      '</div>' +
      '<div class="section detectors">' +
        '<h3>Detectors</h3>' +
        detectorsHtml +
      '</div>' +
      '<div class="section ai-analysis">' +
        '<h3>AI Analysis</h3>' +
        '<p>' + escapeHtml(finding.aiAnalysis || '') + '</p>' +
      '</div>' +
    '</div>';
}

function handleSearch(query) {
  renderTree({ query });
}

function handleThreatsOnlyToggle() {
  renderTree({});
}

function handleThemeToggle() {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('sapper-theme', next); } catch {}
}

function handleChartBarClick(level) {
  const state = window.__TREE_STATE || {};
  state.riskFilter = level;
  window.__TREE_STATE = state;
  renderTree({});
}

function renderChart() {
  const findings = Array.isArray(SCAN_DATA.findings) ? SCAN_DATA.findings : [];
  const critical = findings.filter((f) => Number(f.risk) >= 0.8).length;
  const high = findings.filter((f) => Number(f.risk) >= 0.5 && Number(f.risk) < 0.8).length;
  const clean = findings.filter((f) => Number(f.risk) < 0.5).length;
  const total = Math.max(1, findings.length);

  const bars = el('#chart-bars');
  if (!bars) return;
  bars.innerHTML = '';

  function mk(cls, count, level) {
    const wrap = document.createElement('div');
    wrap.className = 'bar';
    wrap.title = level + ': ' + count;
    wrap.addEventListener('click', () => handleChartBarClick(level));
    const span = document.createElement('span');
    span.className = cls;
    span.style.height = Math.round((count / total) * 100) + '%';
    span.style.position = 'absolute';
    span.style.bottom = '0';
    wrap.appendChild(span);
    return wrap;
  }

  bars.appendChild(mk('critical', critical, 'critical'));
  bars.appendChild(mk('high', high, 'high'));
  bars.appendChild(mk('clean', clean, 'clean'));

  const legend = el('#chart-legend');
  if (legend) {
    legend.innerHTML =
      '<span>Critical (>=0.8): ' + critical + '</span>' +
      '<span>High (>=0.5): ' + high + '</span>' +
      '<span>Clean (<0.5): ' + clean + '</span>';
  }
}

function renderTree(partial) {
  const state = window.__TREE_STATE || { query: '', riskFilter: null };
  window.__TREE_STATE = Object.assign({}, state, partial);

  const findings = Array.isArray(SCAN_DATA.findings) ? SCAN_DATA.findings : [];
  const threatsOnlyEl = el('#threats-only');
  const threatsOnly = threatsOnlyEl ? !!threatsOnlyEl.checked : true;

  let visible = findings;
  if (window.__TREE_STATE.riskFilter) {
    const level = window.__TREE_STATE.riskFilter;
    visible = visible.filter((f) => {
      const r = Number(f.risk);
      if (level === 'critical') return r >= 0.8;
      if (level === 'high') return r >= 0.5 && r < 0.8;
      if (level === 'clean') return r < 0.5;
      return true;
    });
  }

  const treeRoot = buildFileTree(visible);
  const tree = el('#tree');
  if (!tree) return;
  tree.innerHTML = '';
  const query = window.__TREE_STATE.query || '';
  const node = renderTreeNode(treeRoot, { query, threatsOnly });
  tree.appendChild(node);

  const first = tree.querySelector('.file-btn');
  if (first) first.tabIndex = 0;
}

function installKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    const items = Array.from(document.querySelectorAll('.file-btn'));
    if (items.length === 0) return;
    const active = document.activeElement;
    const idx = items.indexOf(active);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[Math.min(items.length - 1, Math.max(0, idx + 1))] || items[0];
      next.focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = items[Math.max(0, idx - 1)] || items[0];
      next.focus();
      return;
    }
    if (e.key === 'Enter') {
      if (active && active.classList && active.classList.contains('file-btn')) {
        active.click();
      }
    }
  });
}

function bootstrap() {
  try {
    const saved = localStorage.getItem('sapper-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch {}

  const toggle = el('#theme-toggle');
  if (toggle) toggle.addEventListener('click', handleThemeToggle);

  const search = el('#tree-search');
  if (search) {
    search.addEventListener('input', debounce((e) => handleSearch(e.target.value || ''), 300));
  }

  const threatsOnly = el('#threats-only');
  if (threatsOnly) threatsOnly.addEventListener('change', handleThreatsOnlyToggle);

  renderChart();
  renderTree({ query: '' });
  installKeyboardNav();

  const detail = el('#detail');
  if (detail) {
    detail.innerHTML = '<div class="detail-inner"><div class="file-path">Select a file to view details</div></div>';
  }
}

bootstrap();
`.trim()
}

function renderHeader(result: ScanResult): string {
  return `
<header>
  <div class="logo">SapperAI Scan Report</div>
  <div class="meta">Scanned: ${escapeHtml(result.timestamp)} | Scope: ${escapeHtml(result.scope)}</div>
  <button id="theme-toggle" type="button">Dark/Light</button>
</header>
`.trim()
}

function renderSummary(result: ScanResult): string {
  const total = result.summary.totalFiles
  const threats = result.summary.threats
  const maxRisk = result.findings.reduce((m, f) => Math.max(m, f.risk), 0)
  return `
<section class="summary">
  <div class="metric-card">
    <span class="label">Total Files</span>
    <span class="value">${total.toLocaleString()}</span>
  </div>
  <div class="metric-card">
    <span class="label">Threats</span>
    <span class="value danger">${threats.toLocaleString()}</span>
  </div>
  <div class="metric-card">
    <span class="label">Max Risk</span>
    <span class="value">${maxRisk.toFixed(2)}</span>
  </div>
  <div class="metric-card">
    <span class="label">AI Scan</span>
    <span class="value">${result.ai ? 'Enabled' : 'Disabled'}</span>
  </div>
</section>

<section class="chart">
  <div class="chart-bars" id="chart-bars"></div>
  <div class="chart-legend" id="chart-legend"></div>
</section>
`.trim()
}

function renderMainContent(result: ScanResult): string {
  const threatsCount = result.findings.filter((f) => f.risk >= 0.5).length
  return `
<section class="main">
  <aside class="panel file-tree">
    <div class="controls">
      <input type="text" placeholder="Search files..." id="tree-search" />
      <label class="toggle"><input type="checkbox" id="threats-only" checked /> Threats only (${threatsCount})</label>
    </div>
    <div id="tree" role="tree"></div>
  </aside>
  <main class="panel detail-panel" id="detail"></main>
</section>
`.trim()
}

export function generateHtmlReport(result: ScanResult): string {
  const safeJson = JSON.stringify(result).replace(/<\//g, '<\\/')
  return `<!DOCTYPE html>
<html lang="ko" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SapperAI Scan Report - ${escapeHtml(result.timestamp)}</title>
  <style>${generateCss()}</style>
</head>
<body>
  ${renderHeader(result)}
  <div class="container">
    ${renderSummary(result)}
    ${renderMainContent(result)}
  </div>
  <script>const SCAN_DATA = ${safeJson};</script>
  <script>${generateJs()}</script>
</body>
</html>`
}
