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
  line-height: 1.45;
}

button, input { font: inherit; }

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
  min-width: 0;
}

.meta-scope {
  display: inline-block;
  max-width: 520px;
  vertical-align: bottom;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  border-radius: 16px;
}

.metric-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 10px 12px;
  flex: 1 0 150px;
  min-width: 150px;
}

.metric-card .label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-card .value {
  display: block;
  margin-top: 4px;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.metric-card .value.danger { color: var(--risk-critical); }

.metric-card[data-metric="coverage"] .value {
  font-size: 16px;
}

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

.toggle.inline { margin-top: 0; }

.tree-actions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.mini-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
}

.mini-btn:hover { background: var(--bg-tertiary); }

.mini-btn:focus-visible,
#theme-toggle:focus-visible,
#tree-search:focus-visible,
#tree summary:focus-visible,
.file-btn:focus-visible,
.match-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.tree-root {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.tree-empty {
  padding: 10px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-secondary);
  font-size: 12px;
}

#tree {
  padding: 10px;
  overflow: auto;
  flex: 1;
}

#tree details {
  border-radius: 10px;
}

#tree details > summary::-webkit-details-marker { display: none; }

#tree summary {
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 10px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
}

#tree summary:hover { background: var(--bg-tertiary); }

.tree-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--text-muted);
}
.tree-icon svg { width: 16px; height: 16px; fill: currentColor; }
.tree-spacer { width: 14px; height: 14px; flex: 0 0 auto; }

#tree details > summary .chev {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  flex: 0 0 auto;
  transition: transform 140ms ease;
}

#tree details[open] > summary .chev { transform: rotate(90deg); }

#tree details > summary .dirname { flex: 1 1 auto; }

#tree details > summary .dir-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

#tree details > summary .dir-badge.warn {
  border-color: rgba(245, 158, 11, 0.6);
  color: #f59e0b;
}

#tree details > summary .dir-badge.danger {
  border-color: rgba(239, 68, 68, 0.65);
  color: #ef4444;
}

#tree details > div {
  margin-left: 14px;
  padding-left: 10px;
  border-left: 1px solid var(--border);
}

#tree > div > details > div {
  margin-left: 0;
}

.file-btn {
  width: 100%;
  text-align: left;
  display: flex;
  align-items: flex-start;
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

.file-btn .fname {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-btn .fname > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-btn .fname .sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.tree-spacer { width: 14px; flex: 0 0 auto; }

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
.file-path-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.file-path { font-size: 12px; color: var(--text-secondary); word-break: break-all; }
.file-name { margin-top: 6px; font-size: 18px; font-weight: 700; }
.metrics { margin-top: 10px; display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--text-secondary); }
.badge { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); }
.badge.block { border-color: var(--risk-critical); color: var(--risk-critical); }
.badge.allow { border-color: var(--risk-low); color: var(--risk-low); }

.section { margin-top: 14px; }
.section h3 { margin: 0 0 8px; font-size: 13px; color: var(--text-secondary); }
.patterns ul { margin: 0; padding-left: 18px; }
.reasons ul { margin: 0; padding-left: 18px; }

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

mark.hl {
  color: inherit;
  border-radius: 6px;
  padding: 0 2px;
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  background: linear-gradient(to bottom, transparent 62%, rgba(245, 158, 11, 0.14) 62%);
  text-decoration-color: rgba(245, 158, 11, 0.85);
}

mark.hl[data-sev="high"] {
  background: linear-gradient(to bottom, transparent 62%, rgba(239, 68, 68, 0.14) 62%);
  text-decoration-color: rgba(239, 68, 68, 0.9);
}

mark.hl[data-sev="medium"] {
  background: linear-gradient(to bottom, transparent 62%, rgba(245, 158, 11, 0.14) 62%);
  text-decoration-color: rgba(245, 158, 11, 0.85);
}

mark.hl.active {
  text-decoration-thickness: 3px;
  filter: saturate(1.2);
}

.match-list { display: flex; flex-direction: column; gap: 6px; }
.match-btn {
  text-align: left;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.match-btn:hover { background: var(--bg-tertiary); }
.loc { color: var(--text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }

.muted { color: var(--text-secondary); font-size: 12px; margin: 8px 0 0; }

.match-context-list { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
.match-context {
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  border-radius: 14px;
  padding: 10px;
}
.match-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.match-needle { font-size: 12px; color: var(--text-secondary); margin-top: 4px; word-break: break-word; }
.match-context pre { margin-top: 8px; }

.file-btn:focus-visible,
#tree summary:focus-visible,
#tree-search:focus-visible,
#theme-toggle:focus-visible,
.mini-btn:focus-visible,
.match-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 1024px) {
  .main { grid-template-columns: 40% 60%; }
}

@media (max-width: 768px) {
  header { height: auto; padding: 12px 14px; gap: 10px; flex-wrap: wrap; }
  .container { padding: 14px; }
  .summary { gap: 8px; }
  .metric-card { flex-basis: 140px; min-width: 140px; }
  .main { grid-template-columns: 1fr; }
  #tree { max-height: 260px; }
}

@media (prefers-contrast: more) {
  :root, [data-theme="dark"] {
    --border: #4b4b4b;
    --text-secondary: #d1d1d1;
    --text-muted: #a0a0a0;
  }
  [data-theme="light"] {
    --border: #111827;
    --text-secondary: #374151;
    --text-muted: #4b5563;
  }
}

@media (forced-colors: active) {
  .metric-card,
  .panel,
  pre,
  #theme-toggle,
  #tree-search,
  .mini-btn {
    border-color: CanvasText;
  }
  .metric-card .value.danger { color: CanvasText; }
  .badge,
  .badge.block,
  .badge.allow {
    border-color: CanvasText;
    color: CanvasText;
  }
  .file-btn.active {
    outline: 2px solid Highlight;
    outline-offset: 2px;
    border-color: Highlight;
    border-left-color: Highlight;
  }
}

@media print {
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  header { position: static; }
  .main { grid-template-columns: 1fr; }
  .summary { overflow: visible; flex-wrap: wrap; padding-bottom: 0; }
  .metric-card { min-width: auto; flex: 1 1 220px; }
  .metric-card .label,
  .metric-card .value {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
  }
  .meta-scope { max-width: none; white-space: normal; }
  #tree,
  .detail-inner,
  pre {
    overflow: visible;
    max-height: none;
  }
  pre { white-space: pre-wrap; }
  code { white-space: pre-wrap; overflow-wrap: anywhere; }
  #theme-toggle,
  .controls,
  .tree-actions,
  #tree-search,
  .mini-btn,
  .toggle {
    display: none !important;
  }
}
`.trim()
}

function generateJs(): string {
  return `
const el = (sel) => document.querySelector(sel);

const ICON_FOLDER =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h6z"/></svg>';
const ICON_FILE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm0 2.5L19.5 10H14V4.5z"/></svg>';

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function normalizePath(p) {
  return String(p || '').replace(/\\\\/g, '/');
}

function computeBasePath(findings, targetStr) {
  const paths = [];
  for (const f of findings || []) {
    const fp = normalizePath(f && f.filePath);
    if (fp) paths.push(fp);
  }
  if (paths.length === 0) return '';

  const targets = String(targetStr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizePath);

  if (targets.length === 1) {
    const t = targets[0].replace(/\\/+$/, '');
    if (t && paths.every((p) => p === t || p.startsWith(t + '/'))) {
      return t + '/';
    }
  }

  const segs = paths.map((p) => p.split('/').filter(Boolean));
  let prefix = segs[0].slice();
  for (let i = 1; i < segs.length; i++) {
    const s = segs[i];
    let j = 0;
    while (j < prefix.length && j < s.length && prefix[j] === s[j]) j += 1;
    prefix = prefix.slice(0, j);
    if (prefix.length === 0) break;
  }

  if (prefix.length < 2) return '';
  const lead = paths[0].startsWith('/') ? '/' : '';
  return lead + prefix.join('/') + '/';
}

function toDisplayPath(filePath, basePath) {
  const full = normalizePath(filePath);
  const base = normalizePath(basePath);
  if (base && full.startsWith(base)) {
    return full.slice(base.length).replace(/^\\/+/, '');
  }
  return full.replace(/^\\/+/, '');
}

function fileDisplayInfo(finding, basePath) {
  const fullPath = String(finding && finding.filePath ? finding.filePath : '');
  const normalizedFull = normalizePath(fullPath);
  const displayPath = toDisplayPath(normalizedFull, basePath);
  const displayName =
    displayPath.split('/').filter(Boolean).pop() ||
    normalizedFull.split('/').filter(Boolean).pop() ||
    normalizedFull;
  return { displayPath, displayName };
}

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

function getDirOpenState() {
  if (!window.__DIR_OPEN) window.__DIR_OPEN = {};
  return window.__DIR_OPEN;
}

function buildFileTree(findings, basePath) {
  function mkNode(name) {
    return {
      name,
      files: [],
      dirs: new Map(),
      stats: { total: 0, threats: 0, maxRisk: 0 },
    };
  }

  function bump(node, finding) {
    const r = Number(finding && finding.risk);
    const risk = Number.isFinite(r) ? r : 0;
    node.stats.total += 1;
    if (risk >= 0.5) node.stats.threats += 1;
    if (risk > node.stats.maxRisk) node.stats.maxRisk = risk;
  }

  const root = mkNode('');
  for (const f of findings) {
    const info = fileDisplayInfo(f, basePath);
    f.__displayPath = info.displayPath;
    f.__displayName = info.displayName;

    const parts = String(info.displayPath).split('/').filter(Boolean);
    if (parts.length === 0) continue;
    let node = root;
    bump(node, f);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      if (isFile) {
        node.files.push(f);
      } else {
        if (!node.dirs.has(part)) {
          node.dirs.set(part, mkNode(part));
        }
        node = node.dirs.get(part);
        bump(node, f);
      }
    }
  }
  return root;
}

function renderTreeNode(node, opts, parentPath) {
  const container = document.createElement('div');

  const dirEntries = Array.from(node.dirs.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const dir of dirEntries) {
    const details = document.createElement('details');
    const dirPath = (parentPath ? parentPath + '/' : '') + String(dir.name);
    details.setAttribute('data-dir', dirPath);
    const openState = getDirOpenState();
    if (opts && opts.query) {
      details.open = true;
    } else if (Object.prototype.hasOwnProperty.call(openState, dirPath)) {
      details.open = !!openState[dirPath];
    } else {
      details.open = parentPath === '';
    }
    details.addEventListener('toggle', () => {
      const state = getDirOpenState();
      state[dirPath] = details.open;
    });

    const summary = document.createElement('summary');
    summary.title = dirPath;

    const chev = document.createElement('span');
    chev.className = 'chev';
    chev.textContent = '>';
    summary.appendChild(chev);

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.innerHTML = ICON_FOLDER;
    summary.appendChild(icon);

    const dirname = document.createElement('span');
    dirname.className = 'dirname';
    dirname.textContent = String(dir.name);
    summary.appendChild(dirname);

    const badge = document.createElement('span');
    const threats = Number(dir.stats && dir.stats.threats) || 0;
    const total = Number(dir.stats && dir.stats.total) || 0;
    const maxRisk = Number(dir.stats && dir.stats.maxRisk) || 0;
    badge.className = 'dir-badge' + (maxRisk >= 0.8 ? ' danger' : threats > 0 ? ' warn' : '');
    badge.title = threats > 0 ? (threats + ' threats') : (total + ' files');
    badge.textContent = threats > 0 ? (threats + '/' + total) : String(total);
    summary.appendChild(badge);

    details.appendChild(summary);
    details.appendChild(renderTreeNode(dir, opts, dirPath));
    container.appendChild(details);
  }

  const files = node.files
    .slice()
    .sort((a, b) => String(a.__displayPath || a.filePath).localeCompare(String(b.__displayPath || b.filePath)));
  for (const f of files) {
    const btn = document.createElement('button');
    btn.className = 'file-btn';
    btn.type = 'button';
    btn.setAttribute('data-file', String(f.filePath));
    btn.setAttribute('role', 'treeitem');
    btn.tabIndex = -1;
    btn.title = String(f.__displayPath || f.filePath);

    const spacer = document.createElement('span');
    spacer.className = 'tree-spacer';
    btn.appendChild(spacer);

    const dot = document.createElement('span');
    dot.className = 'dot ' + riskLevel(Number(f.risk));
    btn.appendChild(dot);

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.innerHTML = ICON_FILE;
    btn.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'fname';
    const displayName =
      String(f.__displayName || '').trim() ||
      String(f.filePath).split('/').pop() ||
      String(f.filePath);

    const base = document.createElement('span');
    base.textContent = displayName;
    label.appendChild(base);

    const dp = String(f.__displayPath || '');
    const parent = dp.split('/').slice(0, -1).join('/');
    if (parent) {
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = parent;
      label.appendChild(sub);
    }
    btn.appendChild(label);

    btn.addEventListener('click', () => handleFileClick(String(f.filePath)));
    container.appendChild(btn);
  }

  return container;
}

function uniqStrings(values) {
  const out = [];
  const seen = new Set();
  for (const v of values) {
    const s = String(v || '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function extractQuotedSegments(text) {
  const out = [];
  const s = String(text || '');
  const re = /\\x60([^\\x60]{3,120})\\x60|"([^"]{3,120})"|'([^']{3,120})'/g;
  let m;
  while ((m = re.exec(s))) {
    out.push(m[1] || m[2] || m[3] || '');
  }
  return out;
}

function buildHighlightNeedles(patterns, reasons) {
  const needles = [];

  const add = (value) => {
    const s = String(value || '').trim();
    if (!s) return;
    needles.push(s);
  };

  for (const p of patterns || []) {
    add(p);
    const parts = String(p || '').split(/[^a-zA-Z0-9_-]+/).filter(Boolean);
    for (const part of parts) {
      if (part.length >= 6 || /[\\d_-]/.test(part)) add(part);
    }
  }

  for (const r of reasons || []) {
    for (const q of extractQuotedSegments(r)) add(q);
  }

  const unique = uniqStrings(needles).filter((s) => s.length >= 3 && s.length <= 160);
  return unique.slice(0, 24);
}

function indexToLineCol(text, index) {
  const s = String(text || '');
  const n = Math.max(0, Math.min(s.length, Number(index) || 0));
  let line = 1;
  let col = 1;
  for (let i = 0; i < n; i++) {
    if (s.charCodeAt(i) === 10) {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, col };
}

function normalizeRuleMatches(ruleMatches) {
  const out = [];
  const seen = new Set();
  for (const m of ruleMatches || []) {
    if (!m || typeof m !== 'object') continue;
    const label = typeof m.label === 'string' ? m.label : '';
    const severity = m.severity === 'high' ? 'high' : 'medium';
    const matchText = typeof m.matchText === 'string' ? m.matchText : '';
    const context = typeof m.context === 'string' ? m.context : '';
    if (!label || !matchText) continue;
    const key = label + '\\n' + matchText.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, severity, matchText, context });
    if (out.length >= 24) break;
  }
  return out;
}

function highlightPlainText(text, needle) {
  const s = String(text || '');
  const n = String(needle || '').trim();
  if (!s) return '';
  if (!n) return escapeHtml(s);

  const lower = s.toLowerCase();
  const nl = n.toLowerCase();

  let html = '';
  let pos = 0;
  let from = 0;
  let count = 0;
  const MAX = 8;

  while (count < MAX) {
    const idx = lower.indexOf(nl, from);
    if (idx === -1) break;
    html += escapeHtml(s.slice(pos, idx));
    html += '<mark class="hl">' + escapeHtml(s.slice(idx, idx + nl.length)) + '</mark>';
    pos = idx + nl.length;
    from = pos;
    count += 1;
  }

  html += escapeHtml(s.slice(pos));
  return html;
}

function highlightSnippet(snippet, ruleMatches, patterns, reasons) {
  const text = String(snippet || '');
  const rms = normalizeRuleMatches(ruleMatches);
  const missing = [];

  if (rms.length > 0) {
    if (text.length === 0) {
      for (const rm of rms) {
        missing.push({
          label: rm.label,
          severity: rm.severity,
          matchText: rm.matchText,
          contextHtml: highlightPlainText(rm.context || '', rm.matchText),
        });
      }
      return { html: escapeHtml(text), matches: [], missing };
    }

    const lower = text.toLowerCase();
    const occ = [];
    const found = new Set();
    const MAX_MATCHES = 160;
    const MAX_PER_NEEDLE = 24;

    for (const rm of rms) {
      const needle = String(rm.matchText || '').trim();
      if (!needle || needle.length < 3 || needle.length > 200) continue;
      const nl = needle.toLowerCase();
      let from = 0;
      let count = 0;
      while (count < MAX_PER_NEEDLE && occ.length < MAX_MATCHES) {
        const idx = lower.indexOf(nl, from);
        if (idx === -1) break;
        occ.push({ start: idx, end: idx + nl.length, label: rm.label, severity: rm.severity });
        found.add(rm.label + '\\n' + nl);
        from = idx + Math.max(1, nl.length);
        count += 1;
      }
      if (occ.length >= MAX_MATCHES) break;
    }

    for (const rm of rms) {
      const nl = String(rm.matchText || '').trim().toLowerCase();
      if (!nl) continue;
      const key = rm.label + '\\n' + nl;
      if (found.has(key)) continue;
      missing.push({
        label: rm.label,
        severity: rm.severity,
        matchText: rm.matchText,
        contextHtml: highlightPlainText(rm.context || '', rm.matchText),
      });
      if (missing.length >= 24) break;
    }

    if (occ.length === 0) {
      return { html: escapeHtml(text), matches: [], missing };
    }

    occ.sort((a, b) => a.start - b.start || b.end - a.end);

    const merged = [];
    for (const o of occ) {
      const last = merged[merged.length - 1];
      if (!last || o.start > last.end) {
        merged.push({ start: o.start, end: o.end, labels: [o.label], severity: o.severity });
        continue;
      }
      if (o.end > last.end) last.end = o.end;
      if (last.labels.indexOf(o.label) === -1) last.labels.push(o.label);
      if (o.severity === 'high') last.severity = 'high';
    }

    let html = '';
    let pos = 0;
    const matches = [];
    for (let i = 0; i < merged.length; i++) {
      const r = merged[i];
      html += escapeHtml(text.slice(pos, r.start));
      const id = 'm' + i;
      const seg = text.slice(r.start, r.end);
      const labelText = Array.isArray(r.labels) ? r.labels.slice(0, 4).join(', ') : '';
      const labelAttr = labelText ? (' data-label=\"' + escapeHtml(labelText) + '\" title=\"' + escapeHtml(labelText) + '\"') : '';
      const sevAttr = r.severity ? (' data-sev=\"' + escapeHtml(String(r.severity)) + '\"') : '';
      html += '<mark class=\"hl\" id=\"' + id + '\"' + labelAttr + sevAttr + '>' + escapeHtml(seg) + '</mark>';

      const lc = indexToLineCol(text, r.start);
      const previewBase = seg.replace(/\\s+/g, ' ').trim().slice(0, 70);
      const preview = labelText ? ('[' + labelText + '] ' + previewBase) : previewBase;
      matches.push({ id, start: r.start, loc: lc.line + ':' + lc.col, preview });
      pos = r.end;
    }
    html += escapeHtml(text.slice(pos));

    return { html, matches, missing };
  }

  // Fallback for older scan results without ruleMatches.
  const needles = buildHighlightNeedles(patterns, reasons);
  if (needles.length === 0 || text.length === 0) {
    return { html: escapeHtml(text), matches: [], missing: [] };
  }

  const lower = text.toLowerCase();
  const ranges = [];
  const MAX_MATCHES = 120;
  const MAX_PER_NEEDLE = 20;

  for (const needle of needles) {
    const n = String(needle || '').toLowerCase();
    if (!n) continue;
    let from = 0;
    let count = 0;
    while (count < MAX_PER_NEEDLE && ranges.length < MAX_MATCHES) {
      const idx = lower.indexOf(n, from);
      if (idx === -1) break;
      ranges.push({ start: idx, end: idx + n.length });
      from = idx + Math.max(1, n.length);
      count += 1;
    }
    if (ranges.length >= MAX_MATCHES) break;
  }

  if (ranges.length === 0) {
    return { html: escapeHtml(text), matches: [], missing: [] };
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r.start > last.end) {
      merged.push({ start: r.start, end: r.end });
      continue;
    }
    if (r.end > last.end) last.end = r.end;
  }

  let html = '';
  let pos = 0;
  const matches = [];
  for (let i = 0; i < merged.length; i++) {
    const r = merged[i];
    html += escapeHtml(text.slice(pos, r.start));
    const id = 'm' + i;
    const seg = text.slice(r.start, r.end);
    html += '<mark class=\"hl\" id=\"' + id + '\">' + escapeHtml(seg) + '</mark>';

    const lc = indexToLineCol(text, r.start);
    const preview = seg.replace(/\\s+/g, ' ').trim().slice(0, 80);
    matches.push({ id, start: r.start, loc: lc.line + ':' + lc.col, preview });
    pos = r.end;
  }
  html += escapeHtml(text.slice(pos));

  return { html, matches, missing: [] };
}

function setActiveHighlight(detail, mark) {
  if (!detail || !mark) return;
  detail.querySelectorAll('mark.hl.active').forEach((m) => m.classList.remove('active'));
  mark.classList.add('active');
}

function handleFileClick(filePath) {
  const finding = (SCAN_DATA.findings || []).find((f) => f.filePath === filePath);
  if (!finding) return;

  window.__ACTIVE_FILE = filePath;

  document.querySelectorAll('.file-btn').forEach((b) => b.classList.remove('active'));
  let active = null;
  document.querySelectorAll('.file-btn').forEach((b) => {
    if (b.getAttribute('data-file') === filePath) active = b;
  });
  if (active) {
    active.classList.add('active');
    try { active.scrollIntoView({ block: 'nearest' }); } catch {}
  }

  const detail = el('#detail');
  if (!detail) return;

  const basePath = String(window.__TREE_STATE && window.__TREE_STATE.basePath ? window.__TREE_STATE.basePath : '');
  const info = fileDisplayInfo(finding, basePath);
  const displayPath = String(info.displayPath || filePath);
  const name = String(info.displayName || normalizePath(filePath).split('/').pop() || filePath);
  const patterns = Array.isArray(finding.patterns) ? finding.patterns : [];
  const reasons = Array.isArray(finding.reasons) ? finding.reasons : [];
  const detectors = Array.isArray(finding.detectors) ? finding.detectors : [];
  const ruleMatches = Array.isArray(finding.ruleMatches) ? finding.ruleMatches : [];
  const badgeClass = finding.action === 'block' ? 'block' : 'allow';
  const badgeText = String(finding.action || '').toUpperCase();

  const patternsHtml = patterns.length
    ? patterns.map((p) => '<li>' + escapeHtml(p) + '</li>').join('')
    : '<li>None</li>';
  const reasonsHtml = reasons.length
    ? reasons.map((r) => '<li>' + escapeHtml(r) + '</li>').join('')
    : '<li>None</li>';
  const detectorsHtml = detectors.length
    ? detectors.map((d) => '<span class="badge">' + escapeHtml(d) + '</span>').join('')
    : '<span class="badge">none</span>';

  const hl = highlightSnippet(finding.snippet || '', ruleMatches, patterns, reasons);
  const matchButtonsHtml = hl.matches.length
    ? hl.matches.map((m, i) =>
        '<button class="match-btn" type="button" data-jump="' + m.id + '">' +
          '<span>' + escapeHtml(String(i + 1) + '. ' + (m.preview || 'match')) + '</span>' +
          '<span class="loc">' + escapeHtml(m.loc) + '</span>' +
        '</button>'
      ).join('')
    : '';

  const missingHtml = hl.missing && hl.missing.length
    ? '<div class="match-context-list">' +
        hl.missing.map((m) =>
          '<div class="match-context">' +
            '<div class="match-meta">' +
              '<span>' + escapeHtml(String(m.label || 'match')) + '</span>' +
              '<span class="loc">' + escapeHtml(String(m.severity || '')) + '</span>' +
            '</div>' +
            (m.matchText ? '<div class="match-needle">' + escapeHtml(String(m.matchText)) + '</div>' : '') +
            '<pre><code>' + String(m.contextHtml || '') + '</code></pre>' +
          '</div>'
        ).join('') +
      '</div>'
    : '';

  const matchesSectionHtml =
    (matchButtonsHtml || missingHtml)
      ? '<div class="section matches">' +
          '<h3>Matches</h3>' +
          (matchButtonsHtml
            ? '<div class="match-list">' + matchButtonsHtml + '</div>'
            : '<p class="muted">No matches found in snippet (it may be truncated). See contexts below.</p>') +
          missingHtml +
        '</div>'
      : '';

  detail.innerHTML =
    '<div class="detail-inner">' +
      '<div class="file-header">' +
        '<div class="file-path-row">' +
          '<div class="file-path" title="' + escapeHtml(filePath) + '">' + escapeHtml(displayPath) + '</div>' +
        '</div>' +
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
      '<div class="section reasons">' +
        '<h3>Reasons</h3>' +
        '<ul>' + reasonsHtml + '</ul>' +
      '</div>' +
      matchesSectionHtml +
      '<div class="section snippet">' +
        '<h3>Code Snippet</h3>' +
        '<pre><code>' + hl.html + '</code></pre>' +
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

  const inner = detail.querySelector('.detail-inner');
  if (inner) {
    inner.scrollTop = 0;
    inner.scrollLeft = 0;
  }

  const firstMark = detail.querySelector('mark.hl');
  if (firstMark) setActiveHighlight(detail, firstMark);

  try {
    const next = '#file=' + encodeURIComponent(filePath);
    if (location.hash !== next) location.hash = next;
  } catch {}

  const autoJump = el('#auto-jump');
  if (
    autoJump &&
    autoJump.checked &&
    window.matchMedia &&
    window.matchMedia('(max-width: 768px)').matches
  ) {
    try { detail.focus({ preventScroll: true }); } catch {}
    try { detail.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }); } catch {}
  }
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
  const state = window.__TREE_STATE || { query: '', riskFilter: null, basePath: '' };
  window.__TREE_STATE = Object.assign({}, state, partial);

  const findings = Array.isArray(SCAN_DATA.findings) ? SCAN_DATA.findings : [];
  const threatsOnlyEl = el('#threats-only');
  const threatsOnly = threatsOnlyEl ? !!threatsOnlyEl.checked : true;
  const query = String(window.__TREE_STATE.query || '').trim().toLowerCase();
  const basePath = String(window.__TREE_STATE.basePath || '');

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

  if (threatsOnly) {
    visible = visible.filter((f) => Number(f.risk) >= 0.5);
  }

  for (const f of visible) {
    const info = fileDisplayInfo(f, basePath);
    f.__displayPath = info.displayPath;
    f.__displayName = info.displayName;
  }

  if (query) {
    visible = visible.filter((f) => {
      const dp = String(f.__displayPath || '').toLowerCase();
      const dn = String(f.__displayName || '').toLowerCase();
      return dp.includes(query) || dn.includes(query);
    });
  }

  const tree = el('#tree');
  if (!tree) return;
  tree.innerHTML = '';
  if (visible.length === 0) {
    tree.innerHTML = '<div class="tree-empty">No files match the current filters.</div>';
  } else {
    const treeRoot = buildFileTree(visible, basePath);
    const node = renderTreeNode(treeRoot, { query }, '');
    tree.appendChild(node);

    const first = tree.querySelector('.file-btn');
    if (first) first.tabIndex = 0;
  }

  const root = el('#tree-root');
  if (root) {
    const parts = [];
    const baseLabel = String(basePath || '').replace(/\\/+$/, '');
    if (baseLabel) parts.push('Root: ' + baseLabel);
    else if (SCAN_DATA && SCAN_DATA.target) parts.push('Target: ' + String(SCAN_DATA.target));
    parts.push('Showing: ' + String(visible.length) + '/' + String(findings.length));
    if (window.__TREE_STATE.riskFilter) parts.push('Risk: ' + String(window.__TREE_STATE.riskFilter));
    if (threatsOnly) parts.push('Threats only');
    if (query) parts.push('Search: ' + query);
    root.textContent = parts.join(' | ');
    root.hidden = parts.length === 0;
  }
}

function installKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    const target = e.target && e.target.nodeType === 1 ? e.target : null;
    const tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable);

    if (!isTyping && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const search = el('#tree-search');
      if (search) {
        e.preventDefault();
        search.focus();
        if (search.select) search.select();
      }
      return;
    }

    if (e.key === 'Escape') {
      const search = el('#tree-search');
      if (search && typeof search.value === 'string' && search.value.length > 0) {
        e.preventDefault();
        search.value = '';
        handleSearch('');
        try { search.focus(); } catch {}
      }
      return;
    }

    if (isTyping) return;

    const items = Array.from(document.querySelectorAll('.file-btn'));
    if (items.length === 0) return;
    const active = document.activeElement;
    const idx = items.indexOf(active);

    if (e.key === 'ArrowDown') {
      if (idx === -1) return;
      e.preventDefault();
      const next = items[Math.min(items.length - 1, Math.max(0, idx + 1))] || items[0];
      next.focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      if (idx === -1) return;
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

  const findings = Array.isArray(SCAN_DATA.findings) ? SCAN_DATA.findings : [];
  const basePath = computeBasePath(findings, SCAN_DATA && SCAN_DATA.target);
  const state = window.__TREE_STATE || { query: '', riskFilter: null };
  window.__TREE_STATE = Object.assign({}, state, { basePath });

  const autoJump = el('#auto-jump');
  if (autoJump) {
    try {
      const saved = localStorage.getItem('sapper-auto-jump');
      if (saved === '0' || saved === '1') autoJump.checked = saved === '1';
    } catch {}

    autoJump.addEventListener('change', () => {
      try { localStorage.setItem('sapper-auto-jump', autoJump.checked ? '1' : '0'); } catch {}
    });
  }

  function setAllDirsOpen(open) {
    const state = getDirOpenState();
    document.querySelectorAll('#tree details').forEach((d) => {
      d.open = open;
      const dir = d.getAttribute('data-dir');
      if (dir) state[dir] = open;
    });
  }

  const expandAll = el('#expand-all');
  if (expandAll) expandAll.addEventListener('click', () => setAllDirsOpen(true));

  const collapseAll = el('#collapse-all');
  if (collapseAll) collapseAll.addEventListener('click', () => setAllDirsOpen(false));

  try {
    const findings = Array.isArray(SCAN_DATA && SCAN_DATA.findings) ? SCAN_DATA.findings : [];
    const basePath = computeBasePath(findings, SCAN_DATA && SCAN_DATA.target);
    const state = window.__TREE_STATE || { query: '', riskFilter: null, basePath: '' };
    if (!state.basePath) state.basePath = basePath;
    window.__TREE_STATE = state;
  } catch {}

  renderChart();
  renderTree({ query: '' });
  installKeyboardNav();

  const detail = el('#detail');
  if (detail) {
    detail.addEventListener('click', (e) => {
      const t = e.target && e.target.nodeType === 1 ? e.target : null;
      if (!t) return;

      const btn = t.closest ? t.closest('.match-btn') : null;
      if (btn) {
        const id = btn.getAttribute('data-jump');
        if (!id) return;
        const mark = document.getElementById(id);
        if (!mark) return;
        setActiveHighlight(detail, mark);
        try {
          mark.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        } catch {
          try { mark.scrollIntoView(); } catch {}
        }
        return;
      }

      if (t.matches && t.matches('mark.hl')) {
        setActiveHighlight(detail, t);
      }
    });

    detail.innerHTML = '<div class="detail-inner"><div class="file-path">Select a file to view details</div></div>';

    try {
      const h = String(location.hash || '');
      if (h.startsWith('#file=')) {
        const fp = decodeURIComponent(h.slice('#file='.length));
        if (fp) handleFileClick(fp);
      }
    } catch {}

    window.addEventListener('hashchange', () => {
      try {
        const h = String(location.hash || '');
        if (!h.startsWith('#file=')) return;
        const fp = decodeURIComponent(h.slice('#file='.length));
        if (!fp || window.__ACTIVE_FILE === fp) return;
        handleFileClick(fp);
      } catch {}
    });
  }
}

bootstrap();
`.trim()
}

function renderHeader(result: ScanResult): string {
  return `
<header>
  <div class="logo">SapperAI Scan Report</div>
  <div class="meta">Scanned: ${escapeHtml(result.timestamp)} | Scope: <span class="meta-scope" title="${escapeHtml(result.scope)}">${escapeHtml(result.scope)}</span></div>
  <button id="theme-toggle" type="button">Dark/Light</button>
</header>
`.trim()
}

function renderSummary(result: ScanResult): string {
  const total = result.summary?.totalFiles ?? 0
  const eligible = result.summary?.eligibleFiles ?? 0
  const scanned = result.summary?.scannedFiles ?? 0
  const threats = result.summary?.threats ?? 0
  const maxRisk = result.findings.reduce((m, f) => Math.max(m, f.risk), 0)
  const coverageEligible = eligible > 0 ? (scanned / eligible) * 100 : 0
  const coverageTotal = total > 0 ? (scanned / total) * 100 : 0
  const coverageValue = `${coverageEligible.toFixed(1)}% / ${coverageTotal.toFixed(2)}%`
  const coverageTitle =
    eligible > 0 && total > 0
      ? `Coverage: ${coverageEligible.toFixed(1)}% eligible (${scanned.toLocaleString()}/${eligible.toLocaleString()}) · ${coverageTotal.toFixed(2)}% total (${scanned.toLocaleString()}/${total.toLocaleString()})`
      : 'Coverage: N/A'
  return `
<section class="summary" tabindex="0" role="region" aria-label="Scan summary metrics">
  <div class="metric-card" data-metric="total">
    <span class="label" title="Total files">Total</span>
    <span class="value" title="${total.toLocaleString()}">${total.toLocaleString()}</span>
  </div>
  <div class="metric-card" data-metric="eligible">
    <span class="label" title="Eligible (Config-like)">Eligible</span>
    <span class="value" title="${eligible.toLocaleString()}">${eligible.toLocaleString()}</span>
  </div>
  <div class="metric-card" data-metric="scanned">
    <span class="label" title="Scanned files">Scanned</span>
    <span class="value" title="${scanned.toLocaleString()}">${scanned.toLocaleString()}</span>
  </div>
  <div class="metric-card" data-metric="coverage">
    <span class="label" title="Coverage (eligible / total)">Coverage</span>
    <span class="value" title="${escapeHtml(coverageTitle)}" aria-label="${escapeHtml(coverageTitle)}">${coverageValue}</span>
  </div>
  <div class="metric-card" data-metric="threats">
    <span class="label" title="Threats">Threats</span>
    <span class="value danger" title="${threats.toLocaleString()}">${threats.toLocaleString()}</span>
  </div>
  <div class="metric-card" data-metric="maxRisk">
    <span class="label" title="Max risk">Max risk</span>
    <span class="value" title="${maxRisk.toFixed(2)}">${maxRisk.toFixed(2)}</span>
  </div>
  <div class="metric-card" data-metric="ai">
    <span class="label" title="AI scan">AI scan</span>
    <span class="value" title="${result.ai ? 'On' : 'Off'}">${result.ai ? 'On' : 'Off'}</span>
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
      <div class="tree-actions">
        <label class="toggle inline"><input type="checkbox" id="threats-only" checked /> Threats only (${threatsCount})</label>
        <label class="toggle inline"><input type="checkbox" id="auto-jump" checked /> Auto-jump to details</label>
        <button class="mini-btn" type="button" id="expand-all">Expand all</button>
        <button class="mini-btn" type="button" id="collapse-all">Collapse all</button>
      </div>
      <div class="tree-root" id="tree-root" hidden></div>
    </div>
    <div id="tree" role="tree"></div>
  </aside>
  <main class="panel detail-panel" id="detail" tabindex="-1"></main>
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
