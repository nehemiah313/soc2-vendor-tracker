/* SOC 2 Vendor & Subservice Organization Tracker
 * Readiness aid only. Not an audit, attestation, CPA opinion, or legal advice.
 * Pure logic functions are DOM-free so they can be verified under node.
 */

'use strict';

var STORAGE_KEY = 'soc2vendors';
var REVIEW_INTERVAL_MONTHS = 12;
var REPORT_FRESH_DAYS = 365;
var DUE_SOON_DAYS = 30;

/* ---------- date helpers (YYYY-MM-DD, local) ---------- */

function parseDate(iso) {
  if (!iso) return null;
  var parts = String(iso).split('-');
  if (parts.length !== 3) return null;
  var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return isNaN(d.getTime()) ? null : d;
}

function toISODate(d) {
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return d.getFullYear() + '-' + m + '-' + day;
}

function todayISO() {
  return toISODate(new Date());
}

/* Whole days from aISO to bISO (b - a). Positive when b is later. */
function daysBetween(aISO, bISO) {
  var a = parseDate(aISO), b = parseDate(bISO);
  if (!a || !b) return null;
  var ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

function addMonths(iso, n) {
  var d = parseDate(iso);
  if (!d) return null;
  d.setMonth(d.getMonth() + n);
  return toISODate(d);
}

/* ---------- vendor logic ---------- */

/* A SOC 2 report counts as current when one exists and its date is within REPORT_FRESH_DAYS. */
function isCurrentReport(v, today) {
  if (!v || !v.hasReport || !v.reportDate) return false;
  var age = daysBetween(v.reportDate, today);
  return age !== null && age >= 0 && age <= REPORT_FRESH_DAYS;
}

function isOverdue(v, today) {
  if (!v || !v.nextDue) return false;
  var diff = daysBetween(today, v.nextDue);
  return diff !== null && diff < 0;
}

function isDueSoon(v, today) {
  if (!v || !v.nextDue) return false;
  var diff = daysBetween(today, v.nextDue);
  return diff !== null && diff >= 0 && diff <= DUE_SOON_DAYS;
}

function computeDashboard(vendors, today) {
  today = today || todayISO();
  var d = {
    total: vendors.length,
    critical: 0,
    missingReports: 0,
    dueSoon: 0,
    overdue: 0,
    flagged: []
  };
  vendors.forEach(function (v) {
    var crit = (v.criticality || '').toLowerCase() === 'critical';
    if (crit) d.critical++;
    var current = isCurrentReport(v, today);
    if (!current) d.missingReports++;
    if (isOverdue(v, today)) d.overdue++;
    else if (isDueSoon(v, today)) d.dueSoon++;
    if (crit && !current) d.flagged.push(v);
  });
  return d;
}

/* Annual review: stamp last review to today and push next due out REVIEW_INTERVAL_MONTHS. */
function markReviewed(v, today) {
  today = today || todayISO();
  v.lastReview = today;
  v.nextDue = addMonths(today, REVIEW_INTERVAL_MONTHS);
  return v;
}

function newVendor() {
  return {
    id: 'v' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    name: '',
    service: '',
    access: '',
    criticality: 'Medium',
    hasReport: false,
    reportDate: '',
    reportType: '',
    dpaInPlace: false,
    lastReview: '',
    nextDue: '',
    notes: '',
    example: false
  };
}

function seedVendors() {
  var t = todayISO();
  return [
    {
      id: 'seed-1', name: 'Acme Cloud Hosting', service: 'Cloud infrastructure (IaaS)',
      access: 'Hosts production servers and customer databases', criticality: 'Critical',
      hasReport: true, reportDate: addMonths(t, -4), reportType: 'Type II',
      dpaInPlace: true, lastReview: addMonths(t, -7), nextDue: addMonths(t, 5),
      notes: 'Annual review scheduled with procurement.', example: true
    },
    {
      id: 'seed-2', name: 'Beta Analytics', service: 'Product analytics (subservice organization)',
      access: 'Receives pseudonymized usage events; no direct customer PII', criticality: 'High',
      hasReport: false, reportDate: '', reportType: '',
      dpaInPlace: true, lastReview: addMonths(t, -14), nextDue: addMonths(t, -2),
      notes: 'Requested their SOC 2 Type II twice. Escalate or find alternative.', example: true
    }
  ];
}

/* ---------- storage ---------- */

function loadVendors() {
  try {
    var raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* fall through to seed */ }
  return seedVendors();
}

function saveVendors(vendors) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vendors));
}

/* ---------- exports ---------- */

function csvEscape(val) {
  var s = (val === null || val === undefined) ? '' : String(val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function vendorsToCSV(vendors) {
  var headers = ['Name', 'Service Provided', 'Data/System Access', 'Criticality',
    'Has SOC 2 Report', 'Report Date', 'Report Type', 'DPA/Privacy Commitments In Place',
    'Last Risk Review', 'Next Review Due', 'Risk Notes'];
  var rows = vendors.map(function (v) {
    return [v.name, v.service, v.access, v.criticality,
      v.hasReport ? 'Yes' : 'No', v.reportDate, v.reportType,
      v.dpaInPlace ? 'Yes' : 'No', v.lastReview, v.nextDue, v.notes].map(csvEscape).join(',');
  });
  return headers.join(',') + '\n' + rows.join('\n') + '\n';
}

function vendorsToMarkdown(vendors, today) {
  today = today || todayISO();
  var d = computeDashboard(vendors, today);
  var L = [];
  L.push('# SOC 2 Vendor Risk Summary');
  L.push('');
  L.push('Generated: ' + today);
  L.push('');
  L.push('## Dashboard');
  L.push('');
  L.push('- Total vendors: ' + d.total);
  L.push('- Critical vendors: ' + d.critical);
  L.push('- Missing a current SOC 2 report: ' + d.missingReports);
  L.push('- Reviews due within 30 days: ' + d.dueSoon);
  L.push('- Overdue reviews: ' + d.overdue);
  L.push('');
  L.push('## Critical vendors without a current SOC 2 report');
  L.push('');
  if (d.flagged.length === 0) {
    L.push('None. Every critical vendor has a SOC 2 report dated within the last 12 months.');
  } else {
    d.flagged.forEach(function (v) {
      L.push('- ' + v.name + ' (' + v.service + '): ' +
        (v.hasReport ? 'report dated ' + v.reportDate + ' is older than 12 months' : 'no SOC 2 report on file') + '.');
    });
  }
  L.push('');
  L.push('## Vendor register');
  L.push('');
  L.push('| Vendor | Service | Criticality | SOC 2 report | DPA in place | Last review | Next due | Status |');
  L.push('|---|---|---|---|---|---|---|---|');
  vendors.forEach(function (v) {
    var status = isOverdue(v, today) ? 'OVERDUE' : (isDueSoon(v, today) ? 'Due soon' : 'On track');
    var rep = v.hasReport ? ('Yes (' + (v.reportType || 'type n/a') + ', ' + (v.reportDate || 'no date') + ')') : 'No';
    L.push('| ' + [v.name, v.service, v.criticality, rep, v.dpaInPlace ? 'Yes' : 'No',
      v.lastReview || '-', v.nextDue || '-', status].join(' | ') + ' |');
  });
  L.push('');
  L.push('---');
  L.push('Readiness aid only. Not an audit, attestation, CPA opinion, or legal advice.');
  return L.join('\n');
}

/* ---------- node export for verification ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseDate: parseDate, toISODate: toISODate, todayISO: todayISO,
    daysBetween: daysBetween, addMonths: addMonths,
    isCurrentReport: isCurrentReport, isOverdue: isOverdue, isDueSoon: isDueSoon,
    computeDashboard: computeDashboard, markReviewed: markReviewed,
    newVendor: newVendor, seedVendors: seedVendors,
    vendorsToCSV: vendorsToCSV, vendorsToMarkdown: vendorsToMarkdown
  };
}

/* ---------- browser UI ---------- */
if (typeof document !== 'undefined') {
  (function () {
    var state = { vendors: loadVendors(), tsc: null, editingId: null };

    function esc(s) {
      return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function statusBadge(v) {
      var t = todayISO();
      if (isOverdue(v, t)) return '<span class="badge badge-danger">Review overdue</span>';
      if (isDueSoon(v, t)) return '<span class="badge badge-warn">Due within 30 days</span>';
      return '<span class="badge badge-ok">On track</span>';
    }

    function reportBadge(v) {
      var t = todayISO();
      if (isCurrentReport(v, t)) return '<span class="badge badge-ok">Current</span>';
      if (v.hasReport) return '<span class="badge badge-warn">Stale</span>';
      return '<span class="badge badge-danger">None</span>';
    }

    function renderDashboard() {
      var d = computeDashboard(state.vendors, todayISO());
      var el = document.getElementById('stats');
      el.innerHTML =
        statCard(d.total, 'Total vendors') +
        statCard(d.critical, 'Critical vendors') +
        statCard(d.missingReports, 'Missing current SOC 2 report') +
        statCard(d.dueSoon, 'Reviews due within 30 days') +
        statCard(d.overdue, 'Overdue reviews', d.overdue > 0 ? 'stat-alert' : '');
      var f = document.getElementById('flagged');
      if (d.flagged.length === 0) {
        f.innerHTML = '<p class="muted">No critical vendor is missing a current SOC 2 report. Good.</p>';
      } else {
        f.innerHTML = '<ul class="flag-list">' + d.flagged.map(function (v) {
          return '<li><strong>' + esc(v.name) + '</strong> (' + esc(v.service) + '): ' +
            (v.hasReport ? 'report dated ' + esc(v.reportDate) + ' is older than 12 months.' : 'no SOC 2 report on file.') +
            ' ' + statusBadge(v) + '</li>';
        }).join('') + '</ul>';
      }
    }

    function statCard(n, label, cls) {
      return '<div class="stat ' + (cls || '') + '"><div class="stat-num">' + n + '</div><div class="stat-label">' + label + '</div></div>';
    }

    function renderTable() {
      var tb = document.getElementById('vendorRows');
      if (state.vendors.length === 0) {
        tb.innerHTML = '<tr><td colspan="7" class="muted">No vendors yet. Add your first vendor above.</td></tr>';
        return;
      }
      tb.innerHTML = state.vendors.map(function (v) {
        var ex = v.example ? ' <span class="badge badge-info">EXAMPLE</span>' : '';
        return '<tr>' +
          '<td><strong>' + esc(v.name) + '</strong>' + ex + '<br><span class="muted">' + esc(v.service) + '</span></td>' +
          '<td>' + esc(v.criticality) + '</td>' +
          '<td>' + reportBadge(v) + (v.hasReport && v.reportDate ? '<br><span class="muted">' + esc(v.reportType || '') + ' ' + esc(v.reportDate) + '</span>' : '') + '</td>' +
          '<td>' + (v.dpaInPlace ? 'Yes' : 'No') + '</td>' +
          '<td>' + (v.nextDue ? esc(v.nextDue) : '<span class="muted">not set</span>') + '<br>' + statusBadge(v) + '</td>' +
          '<td class="actions">' +
            '<button data-act="review" data-id="' + v.id + '">Mark reviewed</button>' +
            '<button data-act="edit" data-id="' + v.id + '">Edit</button>' +
            '<button data-act="del" data-id="' + v.id + '" class="danger">Delete</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function renderTsc() {
      var box = document.getElementById('tscRefs');
      if (!state.tsc) { box.innerHTML = '<p class="muted">Criteria data could not be loaded.</p>'; return; }
      var want = ['CC9.2', 'P6.4', 'P6.5'];
      var found = state.tsc.criteria.filter(function (c) { return want.indexOf(c.id) !== -1; });
      box.innerHTML = found.map(function (c) {
        return '<div class="tsc-card"><h3>' + esc(c.id) + ': ' + esc(c.title) + '</h3>' +
          '<p>' + esc(c.summary) + '</p>' +
          '<p class="muted">Typical evidence: ' + esc(c.typical_evidence.join('; ')) + '</p></div>';
      }).join('');
    }

    function renderAll() {
      renderDashboard();
      renderTable();
      renderTsc();
    }

    function openForm(v) {
      state.editingId = v ? v.id : null;
      document.getElementById('formTitle').textContent = v ? 'Edit vendor' : 'Add vendor';
      document.getElementById('f_name').value = v ? v.name : '';
      document.getElementById('f_service').value = v ? v.service : '';
      document.getElementById('f_access').value = v ? v.access : '';
      document.getElementById('f_criticality').value = v ? v.criticality : 'Medium';
      document.getElementById('f_hasReport').checked = v ? !!v.hasReport : false;
      document.getElementById('f_reportDate').value = v ? (v.reportDate || '') : '';
      document.getElementById('f_reportType').value = v ? (v.reportType || '') : '';
      document.getElementById('f_dpa').checked = v ? !!v.dpaInPlace : false;
      document.getElementById('f_lastReview').value = v ? (v.lastReview || '') : '';
      document.getElementById('f_nextDue').value = v ? (v.nextDue || '') : '';
      document.getElementById('f_notes').value = v ? (v.notes || '') : '';
      document.getElementById('modal').classList.add('open');
    }

    function closeForm() {
      document.getElementById('modal').classList.remove('open');
      state.editingId = null;
    }

    function saveForm() {
      var name = document.getElementById('f_name').value.trim();
      if (!name) { alert('Vendor name is required.'); return; }
      var v = state.editingId
        ? state.vendors.filter(function (x) { return x.id === state.editingId; })[0]
        : newVendor();
      if (!v) { closeForm(); return; }
      if (!state.editingId) state.vendors.push(v);
      v.name = name;
      v.service = document.getElementById('f_service').value.trim();
      v.access = document.getElementById('f_access').value.trim();
      v.criticality = document.getElementById('f_criticality').value;
      v.hasReport = document.getElementById('f_hasReport').checked;
      v.reportDate = v.hasReport ? document.getElementById('f_reportDate').value : '';
      v.reportType = v.hasReport ? document.getElementById('f_reportType').value : '';
      v.dpaInPlace = document.getElementById('f_dpa').checked;
      v.lastReview = document.getElementById('f_lastReview').value;
      v.nextDue = document.getElementById('f_nextDue').value;
      v.notes = document.getElementById('f_notes').value.trim();
      if (!state.editingId) v.example = false;
      saveVendors(state.vendors);
      closeForm();
      renderAll();
    }

    function download(filename, content, mime) {
      var blob = new Blob([content], { type: mime });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    document.addEventListener('DOMContentLoaded', function () {
      document.getElementById('addBtn').addEventListener('click', function () { openForm(null); });
      document.getElementById('saveBtn').addEventListener('click', saveForm);
      document.getElementById('cancelBtn').addEventListener('click', closeForm);
      document.getElementById('modal').addEventListener('click', function (e) {
        if (e.target.id === 'modal') closeForm();
      });
      document.getElementById('vendorRows').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        var v = state.vendors.filter(function (x) { return x.id === id; })[0];
        if (!v) return;
        var act = btn.getAttribute('data-act');
        if (act === 'review') {
          markReviewed(v, todayISO());
          saveVendors(state.vendors);
          renderAll();
        } else if (act === 'edit') {
          openForm(v);
        } else if (act === 'del') {
          if (confirm('Delete vendor "' + v.name + '"? This cannot be undone.')) {
            state.vendors = state.vendors.filter(function (x) { return x.id !== id; });
            saveVendors(state.vendors);
            renderAll();
          }
        }
      });
      document.getElementById('exportCsv').addEventListener('click', function () {
        download('soc2-vendor-register.csv', vendorsToCSV(state.vendors), 'text/csv');
      });
      document.getElementById('exportMd').addEventListener('click', function () {
        download('soc2-vendor-risk-summary.md', vendorsToMarkdown(state.vendors, todayISO()), 'text/markdown');
      });
      document.getElementById('resetBtn').addEventListener('click', function () {
        if (confirm('Reset to the two example vendors? Your current register will be replaced.')) {
          state.vendors = seedVendors();
          saveVendors(state.vendors);
          renderAll();
        }
      });
      fetch('data/tsc.json').then(function (r) { return r.json(); }).then(function (j) {
        state.tsc = j;
        renderTsc();
      }).catch(function () { renderTsc(); });
      renderAll();
    });
  })();
}
