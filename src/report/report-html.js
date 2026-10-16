function generateReportHtml(sessions) {
    const sessionsJson = JSON.stringify(sessions)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/<\/script>/gi, "<\\/script>")
        .replace(new RegExp(' ', 'g'), '\\u2028')
        .replace(new RegExp(' ', 'g'), '\\u2029');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Cost Tracker — Report</title>
<script>(function(){var t;try{t=localStorage.getItem('cct-theme')}catch(e){}if(t==='light')document.documentElement.classList.add('light');})()</script>
<style>
/* ── CodeMie token set (dark default, no external fonts) ── */
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Arial, sans-serif;
  --font-mono: "SFMono-Regular", "JetBrains Mono", Consolas, "Liberation Mono", Menlo, monospace;
  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-base: 1rem;
  --text-h2: 1.5rem; --text-h4: 0.875rem; --text-h5: 0.75rem;
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-xl: 12px; --radius-full: 9999px;
  --space-1: 0.25rem; --space-2: 0.5rem; --space-2-5: 0.625rem; --space-3: 0.75rem;
  --space-4: 1rem; --space-5: 1.25rem; --space-6: 1.5rem; --space-8: 2rem;
  --transition-fast: 120ms ease; --transition-base: 200ms ease;
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,.5), 0 2px 4px -2px rgba(0,0,0,.3);
  --z-sticky: 40; --z-modal: 50;
  /* dark palette */
  --color-bg-page: #1A1A1A;
  --color-bg-card: #151515;
  --color-bg-nav: #000000;
  --color-bg-elevated: #2E2E2E;
  --color-bg-secondary: #212224;
  --color-bg-tertiary: #2E3033;
  --color-bg-quaternary: #333436;
  --color-bg-hover: #212224;
  --color-bg-hover-strong: #333436;
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #F2F0EF;
  --color-text-tertiary: #CCCCCC;
  --color-text-muted: #BBBBBB;
  --color-text-link: #2297F6;
  --color-border-structural: #333436;
  --color-border-secondary: #47484A;
  --color-border-panel: #333436;
  --color-info-text: #2297F6;
  --color-info-bg: #002442;
  --color-info-border: #003A69;
  --color-success-text: #259F4C;
  --color-error-text: #FE3B4C;
  --color-warning-text: #F5A534;
  --gradient-brand: linear-gradient(152deg, #0078C2, #0047FF, #8453D2);
}
*, ::after, ::before { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; }
body {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-text-primary);
  background-color: var(--color-bg-page);
  -webkit-font-smoothing: antialiased;
}
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: 0 0; }
::-webkit-scrollbar-thumb { background: var(--color-border-secondary); border-radius: var(--radius-full); }
/* ── Layout ── */
.page { max-width: 1100px; margin: 0 auto; padding: 0 var(--space-6); }
@media (max-width: 640px) { .page { padding: 0 16px; } }
.topbar {
  position: sticky; top: 0; z-index: var(--z-sticky);
  background: color-mix(in srgb, var(--color-bg-page) 88%, transparent);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--color-border-structural);
}
.topbar-in {
  max-width: 1100px; margin: 0 auto; padding: var(--space-2-5) var(--space-6);
  display: flex; align-items: center; gap: var(--space-3);
}
.brand { display: flex; align-items: center; gap: var(--space-2-5); }
.brand-mark {
  width: 28px; height: 28px; border-radius: var(--radius-md);
  background: var(--gradient-brand); display: grid; place-items: center;
  color: #fff; font-weight: 800; font-size: 10px; flex-shrink: 0;
}
.brand-txt strong { display: block; font-size: var(--text-sm); font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }
.brand-txt span { display: block; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--color-text-muted); }
.main { padding: var(--space-6) 0 var(--space-8); }
/* ── Tabs ── */
.tabs-list {
  display: flex; align-items: stretch;
  border-bottom: 1px solid var(--color-border-panel);
  margin-bottom: var(--space-5);
}
.tab-item {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4) var(--space-3);
  font-size: var(--text-sm); color: var(--color-text-muted);
  cursor: pointer; border-bottom: 2px solid transparent;
  transition: border-color var(--transition-base), color var(--transition-base);
  background: none; border-top: none; border-left: none; border-right: none;
  font-family: var(--font-sans); user-select: none; white-space: nowrap;
}
.tab-item:hover { border-bottom-color: var(--color-text-tertiary); color: var(--color-text-primary); }
.tab-item.active { border-bottom-color: var(--color-text-primary); font-weight: 600; color: var(--color-text-primary); cursor: default; }
.tab-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  background: var(--color-bg-quaternary); border: 1px solid var(--color-border-structural);
  font-size: 10px; font-weight: 700; color: var(--color-text-muted); line-height: 1;
}
.tab-item.active .tab-badge { background: var(--color-bg-elevated); color: var(--color-text-primary); }
.tabs-panel { display: none; }
.tabs-panel.active { display: block; }
/* ── Sessions table ── */
.sessions-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--text-xs); }
.sessions-table thead th {
  text-align: left; padding: var(--space-2-5) var(--space-4);
  font-weight: 600; color: var(--color-text-primary);
  background: var(--color-bg-quaternary);
  border-top: 1px solid var(--color-border-structural);
  border-bottom: 1px solid var(--color-border-structural);
  white-space: nowrap; position: sticky; top: 0; z-index: 1;
}
.sessions-table thead th:first-child { border-left: 1px solid var(--color-border-structural); border-radius: var(--radius-lg) 0 0 0; }
.sessions-table thead th:last-child { border-right: 1px solid var(--color-border-structural); border-radius: 0 var(--radius-lg) 0 0; }
.session-row { cursor: pointer; transition: background var(--transition-fast); }
.session-row td { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border-structural); color: var(--color-text-secondary); vertical-align: middle; }
.session-row:hover td { background: var(--color-bg-hover); }
.session-row.open td { background: var(--color-bg-secondary); }
.toggle-icon { font-size: 10px; color: var(--color-text-muted); margin-right: var(--space-2); }
.cost { font-variant-numeric: tabular-nums; }
.detail-row td { padding: 0; border-bottom: 1px solid var(--color-border-structural); }
.detail-panel { padding: var(--space-4) var(--space-4) var(--space-4) calc(var(--space-4) + 18px); background: var(--color-bg-secondary); display: none; }
.detail-panel.open { display: block; }
.detail-meta { display: flex; gap: var(--space-6); margin-bottom: var(--space-4); flex-wrap: wrap; }
.detail-meta-item { font-size: var(--text-xs); color: var(--color-text-muted); }
.detail-meta-item strong { color: var(--color-text-primary); margin-left: var(--space-1); }
/* ── Inner stages table (inside session expand) ── */
.stages-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--text-xs); }
.stages-table thead th {
  text-align: left; padding: var(--space-2) var(--space-3);
  font-weight: 600; color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border-structural);
  border-bottom: 1px solid var(--color-border-structural);
}
.stages-table thead th:first-child { border-left: 1px solid var(--color-border-structural); border-radius: var(--radius-md) 0 0 0; }
.stages-table thead th:last-child { border-right: 1px solid var(--color-border-structural); border-radius: 0 var(--radius-md) 0 0; }
.stages-table tbody td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-structural); color: var(--color-text-secondary); }
.stages-table tbody tr:last-child td { border-bottom: none; }
/* ── Stages tab table ── */
.stab-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--text-xs); }
.stab-table thead th {
  text-align: left; padding: var(--space-2-5) var(--space-4);
  font-weight: 600; color: var(--color-text-primary);
  background: var(--color-bg-quaternary);
  border-top: 1px solid var(--color-border-structural);
  border-bottom: 1px solid var(--color-border-structural);
  white-space: nowrap; position: sticky; top: 0; z-index: 1;
}
.stab-table thead th:first-child { border-left: 1px solid var(--color-border-structural); border-radius: var(--radius-lg) 0 0 0; }
.stab-table thead th:last-child { border-right: 1px solid var(--color-border-structural); border-radius: 0 var(--radius-lg) 0 0; }
.stab-table tbody td { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border-structural); color: var(--color-text-secondary); vertical-align: middle; }
.stab-table tbody tr:hover td { background: var(--color-bg-hover); }
.stab-table tbody tr:last-child td { border-bottom: none; }
/* ── Stage name link ── */
.stage-name-link {
  color: var(--color-info-text); cursor: pointer; text-decoration: underline;
  text-underline-offset: 2px; font-size: inherit; background: none; border: none;
  padding: 0; font-family: inherit;
}
.stage-name-link:hover { opacity: 0.8; }
/* ── Aggregate modal ── */
.agg-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--z-modal); padding: var(--space-4);
}
.agg-modal {
  background: var(--color-bg-elevated); border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-xl); max-width: 800px; width: 100%;
  max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;
  box-shadow: var(--shadow-md);
}
.agg-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border-structural);
}
.agg-title { font-size: var(--text-base); font-weight: 600; }
.agg-close {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: var(--radius-lg);
  border: none; background: none; color: var(--color-text-muted);
  cursor: pointer; font-size: 16px; transition: color var(--transition-fast), background-color var(--transition-fast);
}
.agg-close:hover { color: var(--color-text-primary); background: var(--color-bg-quaternary); }
.agg-body { padding: var(--space-4); overflow-y: auto; }
.agg-stats { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; }
.agg-stat {
  background: var(--color-bg-secondary); border: 1px solid var(--color-border-structural);
  border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); min-width: 100px; flex: 1;
}
.agg-stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--color-text-muted); }
.agg-stat-value { font-size: 1.2rem; font-weight: 700; color: var(--color-text-primary); margin-top: var(--space-1); font-variant-numeric: tabular-nums; }
.agg-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--text-xs); }
.agg-table thead th {
  text-align: left; padding: var(--space-2) var(--space-3);
  font-weight: 600; color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border-structural);
  border-bottom: 1px solid var(--color-border-structural);
}
.agg-table thead th:first-child { border-left: 1px solid var(--color-border-structural); border-radius: var(--radius-md) 0 0 0; }
.agg-table thead th:last-child { border-right: 1px solid var(--color-border-structural); border-radius: 0 var(--radius-md) 0 0; }
.agg-table tbody td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-structural); color: var(--color-text-secondary); }
.agg-table tbody tr:last-child td { border-bottom: none; }
.empty { padding: var(--space-8) 0; color: var(--color-text-muted); text-align: center; }
/* ── Light mode ── */
html.light {
  --color-bg-page: #F9F9F9;
  --color-bg-card: #FFFFFF;
  --color-bg-nav: #FBFBFB;
  --color-bg-elevated: #FFFFFF;
  --color-bg-secondary: #FFFFFF;
  --color-bg-tertiary: #FBFBFB;
  --color-bg-quaternary: #B2D7FF;
  --color-bg-hover: #D5E7FC;
  --color-bg-hover-strong: #D5E7FC;
  --color-text-primary: #333333;
  --color-text-secondary: #333333;
  --color-text-tertiary: #333333;
  --color-text-muted: #666666;
  --color-text-link: #007AFF;
  --color-border-structural: #E5E5E5;
  --color-border-secondary: #BBBBBB;
  --color-border-panel: #E5E5E5;
  --color-info-text: #007AFF;
  --color-info-bg: #D5E7FC;
  --color-info-border: #2297F6;
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,.08), 0 2px 4px -2px rgba(0,0,0,.06);
}
/* ── Theme toggle button ── */
.theme-btn {
  margin-left: auto; display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-structural);
  background: var(--color-bg-secondary); color: var(--color-text-muted);
  cursor: pointer; font-size: 15px; flex-shrink: 0;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}
.theme-btn:hover { background: var(--color-bg-hover-strong); color: var(--color-text-primary); border-color: var(--color-border-secondary); }
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-in">
    <div class="brand">
      <div class="brand-mark">CC</div>
      <div class="brand-txt">
        <strong>Cost Tracker</strong>
        <span>Report</span>
      </div>
    </div>
    <button class="theme-btn" id="theme-btn" onclick="toggleTheme()" aria-label="Toggle theme">&#9788;</button>
  </div>
</div>
<div class="page">
<div class="main">
  <div class="tabs-list" id="tabs-list">
    <button class="tab-item active" onclick="switchTab('sessions')" id="tab-sessions">
      Sessions <span class="tab-badge" id="badge-sessions">0</span>
    </button>
    <button class="tab-item" onclick="switchTab('stages')" id="tab-stages">
      Stages <span class="tab-badge" id="badge-stages">0</span>
    </button>
  </div>
  <div class="tabs-panel active" id="panel-sessions">
    <div id="sessions-container"></div>
  </div>
  <div class="tabs-panel" id="panel-stages">
    <div id="stages-container"></div>
  </div>
</div>
</div>
<!-- Aggregate modal -->
<div id="agg-overlay" class="agg-overlay" style="display:none" role="dialog" aria-modal="true">
  <div class="agg-modal">
    <div class="agg-header">
      <span class="agg-title" id="agg-title"></span>
      <button class="agg-close" id="agg-close" aria-label="Close">&times;</button>
    </div>
    <div class="agg-body" id="agg-body"></div>
  </div>
</div>
<script>
const SESSIONS = JSON.parse('${sessionsJson}');

function fmt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? '$' + n.toFixed(4) : '-';
}
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function fmtDate(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function formatElapsedForDisplay(time) {
  if (typeof time !== 'string') return '-';
  var m = /^(\\d+):(\\d+):(\\d+)$/.exec(time.trim());
  if (!m) return time;
  var h = +m[1], min = +m[2], sec = +m[3];
  if (h > 0) return h + 'h ' + min + 'm ' + sec + 's';
  if (min > 0) return min + 'm ' + sec + 's';
  return sec + 's';
}

/* ── Tab switching ── */
function switchTab(name) {
  ['sessions', 'stages'].forEach(function(t) {
    document.getElementById('tab-' + t).classList.toggle('active', t === name);
    document.getElementById('panel-' + t).classList.toggle('active', t === name);
  });
}

/* ── Sessions tab ── */
function renderSessions() {
  const container = document.getElementById('sessions-container');
  document.getElementById('badge-sessions').textContent = SESSIONS.length;
  if (!SESSIONS.length) {
    container.innerHTML = '<p class="empty">No sessions recorded.</p>';
    return;
  }
  let html = '<table class="sessions-table"><thead><tr>' +
    '<th></th><th>Session</th><th>Model</th><th>Created</th><th class="cost">Total Cost</th><th>Stages</th>' +
    '</tr></thead><tbody>';
  SESSIONS.forEach(function(s, i) {
    const name = esc(s.session_name || s.session_id);
    const model = esc(s.model || 'Unknown');
    const stages = Array.isArray(s.checkpoints) ? s.checkpoints.length : 0;
    html += '<tr class="session-row" data-idx="' + i + '" onclick="toggleSession(' + i + ')">' +
      '<td><span class="toggle-icon" id="icon-' + i + '">▶</span></td>' +
      '<td>' + name + '</td>' +
      '<td>' + model + '</td>' +
      '<td>' + fmtDate(s.created_at) + '</td>' +
      '<td class="cost">' + fmt(s.total_cost_usd) + '</td>' +
      '<td>' + stages + '</td>' +
      '</tr>' +
      '<tr class="detail-row" id="detail-row-' + i + '">' +
      '<td colspan="6"><div class="detail-panel" id="detail-' + i + '">' +
      renderDetailPanel(s) +
      '</div></td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderDetailPanel(s) {
  const dateRange = (s.created_at && s.updated_at)
    ? fmtDate(s.created_at) + ' \\u2013 ' + fmtDate(s.updated_at)
    : fmtDate(s.created_at);
  var cpsForModels = Array.isArray(s.checkpoints) ? s.checkpoints : [];
  var modelSet = [];
  cpsForModels.forEach(function(cp) { if (cp.model && modelSet.indexOf(cp.model) === -1) modelSet.push(cp.model); });
  if (!modelSet.length && s.model) modelSet = [s.model];
  var modelsHtml = modelSet.length
    ? modelSet.map(function(m) { return '<span style="display:inline-block;margin-right:var(--space-2)">' + esc(m) + '</span>'; }).join('')
    : 'Unknown';
  let html = '<div class="detail-meta">' +
    '<div class="detail-meta-item">Models <strong>' + modelsHtml + '</strong></div>' +
    '<div class="detail-meta-item">Date range <strong>' + dateRange + '</strong></div>' +
    '<div class="detail-meta-item">Total cost <strong>' + fmt(s.total_cost_usd) + '</strong></div>' +
    '</div>';
  const cps = Array.isArray(s.checkpoints) ? s.checkpoints : [];
  if (!cps.length) {
    html += '<p style="color:var(--color-text-muted);font-size:var(--text-xs)">No stages recorded.</p>';
    return html;
  }
  html += '<table class="stages-table"><thead><tr>' +
    '<th>Stage</th><th>Model</th><th class="cost">Cost</th><th>Elapsed</th>' +
    '</tr></thead><tbody>';
  cps.forEach(function(cp) {
    const stageName = esc(cp.name || '-');
    const elapsed = cp.time ? esc(formatElapsedForDisplay(cp.time)) : '-';
    html += '<tr><td>' +
      '<button class="stage-name-link" data-stage="' + esc(cp.name ?? '') + '" onclick="event.stopPropagation();showAggregate(this.dataset.stage||null)">' + stageName + '</button>' +
      '</td><td>' + esc(cp.model || '-') + '</td><td class="cost">' + fmt(cp.cost_usd) + '</td><td>' + elapsed + '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function toggleSession(idx) {
  const panel = document.getElementById('detail-' + idx);
  const icon = document.getElementById('icon-' + idx);
  const row = document.querySelector('.session-row[data-idx="' + idx + '"]');
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  if (row) row.classList.toggle('open', !isOpen);
  if (icon) icon.textContent = isOpen ? '\\u25B6' : '\\u25BC';
}

/* ── Stages tab ── */
function parseTimeSecs(t) {
  if (typeof t !== 'string') return NaN;
  var m = /^(\\d+):(\\d+):(\\d+)$/.exec(t.trim());
  if (!m) return NaN;
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}
function secsToDisplay(s) {
  if (!Number.isFinite(s) || s < 0) return '-';
  var h = Math.floor(s / 3600), min = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  if (h > 0) return h + 'h ' + min + 'm ' + sec + 's';
  if (min > 0) return min + 'm ' + sec + 's';
  return sec + 's';
}
function buildStageAggregates() {
  var map = Object.create(null);
  SESSIONS.forEach(function(s) {
    var cps = Array.isArray(s.checkpoints) ? s.checkpoints : [];
    cps.forEach(function(cp) {
      var key = cp.name != null ? cp.name : '';
      if (!map[key]) map[key] = { name: cp.name, count: 0, costs: [], times: [] };
      map[key].count++;
      var c = Number(cp.cost_usd);
      if (Number.isFinite(c)) map[key].costs.push(c);
      var t = parseTimeSecs(cp.time);
      if (Number.isFinite(t)) map[key].times.push(t);
    });
  });
  return Object.values(map).sort(function(a, b) { return b.count - a.count; });
}

function renderStages() {
  var aggs = buildStageAggregates();
  document.getElementById('badge-stages').textContent = aggs.length;
  var container = document.getElementById('stages-container');
  if (!aggs.length) {
    container.innerHTML = '<p class="empty">No stages recorded.</p>';
    return;
  }
  var html = '<table class="stab-table"><thead><tr>' +
    '<th>Stage</th><th>Occurrences</th>' +
    '<th class="cost">Total</th><th class="cost">Avg</th>' +
    '<th class="cost">Min</th><th class="cost">Max</th>' +
    '</tr></thead><tbody>';
  aggs.forEach(function(a) {
    var total = a.costs.reduce(function(x, y) { return x + y; }, 0);
    var avg = a.costs.length ? total / a.costs.length : NaN;
    var min = a.costs.length ? Math.min.apply(null, a.costs) : NaN;
    var max = a.costs.length ? Math.max.apply(null, a.costs) : NaN;
    var label = esc(a.name != null && a.name !== '' ? a.name : '(unnamed)');
    var dataStage = esc(a.name ?? '');
    html += '<tr><td>' +
      '<button class="stage-name-link" data-stage="' + dataStage + '" onclick="showAggregate(this.dataset.stage||null)">' + label + '</button>' +
      '</td><td>' + a.count +
      '</td><td class="cost">' + fmt(total) +
      '</td><td class="cost">' + fmt(avg) +
      '</td><td class="cost">' + fmt(min) +
      '</td><td class="cost">' + fmt(max) + '</td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

/* ── Aggregate modal ── */
function showAggregate(stageName) {
  var matching = [];
  SESSIONS.forEach(function(s) {
    var cps = Array.isArray(s.checkpoints) ? s.checkpoints : [];
    cps.forEach(function(cp) {
      if (cp.name === stageName) matching.push({ session: s, cp: cp });
    });
  });
  var costs = matching.map(function(x) { return Number(x.cp.cost_usd); }).filter(Number.isFinite);
  var total = costs.reduce(function(a, b) { return a + b; }, 0);
  var avg = costs.length ? total / costs.length : NaN;
  var minC = costs.length ? Math.min.apply(null, costs) : NaN;
  var maxC = costs.length ? Math.max.apply(null, costs) : NaN;
  var times = matching.map(function(x) { return parseTimeSecs(x.cp.time); }).filter(Number.isFinite);
  var tTotal = times.reduce(function(a, b) { return a + b; }, 0);
  var tAvg = times.length ? tTotal / times.length : NaN;
  var tMin = times.length ? Math.min.apply(null, times) : NaN;
  var tMax = times.length ? Math.max.apply(null, times) : NaN;

  var label = stageName != null && stageName !== '' ? stageName : '(unnamed)';
  document.getElementById('agg-title').textContent = 'Stage: ' + label;

  var html = '<div class="agg-stats">' +
    stat('Occurrences', matching.length) +
    stat('Cost Total', fmt(total)) +
    stat('Cost Avg', fmt(avg)) +
    stat('Cost Min', fmt(minC)) +
    stat('Cost Max', fmt(maxC)) +
    '</div>' +
    '<div class="agg-stats">' +
    stat('Time Total', times.length ? secsToDisplay(tTotal) : '-') +
    stat('Time Avg', times.length ? secsToDisplay(tAvg) : '-') +
    stat('Time Min', times.length ? secsToDisplay(tMin) : '-') +
    stat('Time Max', times.length ? secsToDisplay(tMax) : '-') +
    '</div>';
  html += '<table class="agg-table"><thead><tr>' +
    '<th>Session</th><th>Model</th><th class="cost">Cost</th><th>Elapsed</th>' +
    '</tr></thead><tbody>';
  matching.forEach(function(x) {
    var sName = esc(x.session.session_name || x.session.session_id);
    var elapsed = x.cp.time ? esc(formatElapsedForDisplay(x.cp.time)) : '-';
    html += '<tr><td>' + sName + '</td><td>' + esc(x.cp.model || '-') + '</td>' +
      '<td class="cost">' + fmt(x.cp.cost_usd) + '</td><td>' + elapsed + '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('agg-body').innerHTML = html;
  document.getElementById('agg-overlay').style.display = 'flex';
}

function stat(label, value) {
  return '<div class="agg-stat"><div class="agg-stat-label">' + esc(label) + '</div>' +
    '<div class="agg-stat-value">' + esc(String(value)) + '</div></div>';
}

document.getElementById('agg-close').addEventListener('click', function() {
  document.getElementById('agg-overlay').style.display = 'none';
});
document.getElementById('agg-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.style.display = 'none';
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') document.getElementById('agg-overlay').style.display = 'none';
});

function toggleTheme() {
  var light = document.documentElement.classList.toggle('light');
  document.getElementById('theme-btn').innerHTML = light ? '&#9790;' : '&#9788;';
  try { localStorage.setItem('cct-theme', light ? 'light' : 'dark'); } catch(e) {}
}
(function() {
  if (document.documentElement.classList.contains('light'))
    document.getElementById('theme-btn').innerHTML = '&#9790;';
})();

renderSessions();
renderStages();
</script>
</body>
</html>`;
}

module.exports = { generateReportHtml };
