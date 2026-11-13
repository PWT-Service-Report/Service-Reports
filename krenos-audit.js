// ══════════════════════════════════════════════════════════════
//  Krenos — report quality checks and engineer scorecard
// ══════════════════════════════════════════════════════════════
//  Loaded by the management dashboard only. The engineers' app never
//  loads this file and never shows its results: they are for
//  management, who speak to the engineer themselves if needed.
//
//  Every rule is in RULES below, with what it costs a report. A rule
//  that turns out to fire on good reports is softened or removed
//  there, and the whole dashboard follows.
//
//  Needs krenos-params.js (PARAMS, paramMark) loaded first.
// ══════════════════════════════════════════════════════════════

const RULES = {
  // ── Numbers that cannot be true — a misread or a guess ──
  NEGATIVE:          { sev: 'high',   cost: 15, text: 'A negative reading' },
  PH_IMPOSSIBLE:     { sev: 'high',   cost: 15, text: 'pH outside 0–14' },
  P_ABOVE_M:         { sev: 'high',   cost: 15, text: 'P-Alkalinity above M-Alkalinity' },
  CA_ABOVE_TH:       { sev: 'high',   cost: 15, text: 'Ca Hardness above Total Hardness' },
  TH_ABOVE_TDS:      { sev: 'high',   cost: 15, text: 'Total Hardness above TDS' },
  BOILER_BELOW_FEED: { sev: 'medium', cost: 10, text: 'Boiler water TDS below feed water TDS' },
  CIRCUIT_BELOW_MU:  { sev: 'medium', cost: 10, text: 'Circuit water below make-up water' },
  CYCLES_DISAGREE:   { sev: 'medium', cost: 10, text: 'Cycles by chloride and by TDS disagree' },
  TDS_COND_RATIO:    { sev: 'medium', cost: 8,  text: 'TDS and conductivity do not match' },

  // ── Signs of a copied or hurried visit ──
  SAME_AS_LAST:      { sev: 'high',   cost: 25, text: 'Readings identical to the previous visit' },
  EMPTY_REPORT:      { sev: 'high',   cost: 20, text: 'No readings at all' },
  OUT_NO_ADVICE:     { sev: 'medium', cost: 10, text: 'Out-of-range readings with no recommendation' },
  ROUND_NUMBERS:     { sev: 'low',    cost: 5,  text: 'Almost every reading is a round number' },
  THIN_SYSTEM:       { sev: 'low',    cost: 5,  text: 'Very few readings for this system' },
  NO_STOCK:          { sev: 'low',    cost: 3,  text: 'Treatment product without stock on site' },

  // ── Place and time ──
  FAR_FROM_SITE:     { sev: 'high',   cost: 20, text: 'Sent far from where this client is usually visited' },
  TOO_CLOSE_IN_TIME: { sev: 'medium', cost: 10, text: 'Two different clients minutes apart' },
  NO_LOCATION:       { sev: 'info',   cost: 0,  text: 'No location recorded' },
};

const AUDIT = {
  FAR_KM: 3,              // from the client's usual spot
  TOO_CLOSE_MIN: 15,      // two clients, same engineer
  SAMPLE_ONE_IN: 10,      // random reviews: about one report in ten
  REVIEW_BELOW: 80,       // a score under this goes to the review queue
  // The overall score, out of 100.
  WEIGHT_COVERAGE: 0.4,
  WEIGHT_QUALITY:  0.4,
  WEIGHT_REVIEW:   0.2,
};

const VISITS_PER_MONTH = { 'Weekly': 4, 'Bi-weekly': 2, 'Monthly': 1 };

// ── small helpers ─────────────────────────────────────────────

function auditNum(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const n = parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : NaN;
}

function auditSystems(report) {
  let s = report.systems_raw !== undefined ? report.systems_raw : report.systems;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = []; } }
  return Array.isArray(s) ? s : [];
}

// { "Boiler Water": { "pH": 11.2, … }, … } with numbers only.
function auditSections(sys) {
  const src = sys.sections && Object.keys(sys.sections).length
    ? sys.sections : { '': sys.readings || {} };
  const out = {};
  Object.entries(src).forEach(([sec, vals]) => {
    out[sec] = {};
    Object.entries(vals || {}).forEach(([label, v]) => {
      const n = auditNum(v);
      if (!isNaN(n)) out[sec][label] = n;
    });
  });
  return out;
}

function auditReadingCount(sys) {
  return Object.values(auditSections(sys)).reduce((n, s) => n + Object.keys(s).length, 0);
}

function auditDefFor(type, label, sec) {
  const def = (typeof PARAMS !== 'undefined') && PARAMS[type];
  if (!def) return null;
  const s = def.sections.find(x => x.title === sec);
  const p = s && s.params.find(x => x.label === label);
  if (p) return p;
  for (const x of def.sections) for (const q of x.params) if (q.label === label) return q;
  return null;
}

function auditKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function auditTime(r) {
  const t = new Date(r.submitted_at || r.timestamp || r.created_at).getTime();
  return isFinite(t) ? t : 0;
}

const auditNorm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

function sameSystem(a, b) {
  if (a.system_id && b.system_id) return a.system_id === b.system_id;
  return a.type === b.type && auditNorm(a.name) === auditNorm(b.name);
}

function clientKey(r) { return r.client_id || r.client_code || ''; }

// Deterministic, so a report picked for review stays picked on reload.
function auditSampled(report) {
  const s = String(report.id || report.ref || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (Math.abs(h) % AUDIT.SAMPLE_ONE_IN) === 0;
}

// ── checking one report ───────────────────────────────────────
// `all` is every report the dashboard holds, newest or oldest first.
// Returns { score, flags: [{ code, sev, cost, text, system, detail }] }

function auditReport(report, all) {
  const flags = [];
  const add = (code, system, detail) => {
    const r = RULES[code];
    flags.push({ code, sev: r.sev, cost: r.cost, text: r.text, system: system || '', detail: detail || '' });
  };
  const systems = auditSystems(report);
  const t = auditTime(report);

  // Earlier reports on the same client, newest first.
  const earlier = (all || [])
    .filter(o => o !== report && (o.id || o.ref) !== (report.id || report.ref)
              && clientKey(o) && clientKey(o) === clientKey(report) && auditTime(o) < t)
    .sort((a, b) => auditTime(b) - auditTime(a));

  let readingsInReport = 0;

  systems.forEach(sys => {
    const secs = auditSections(sys);
    const name = sys.name || '';
    const count = auditReadingCount(sys);
    readingsInReport += count;
    if (!count) return;

    const get = (sec, label) => (secs[sec] || {})[label];
    const allVals = [];

    // ── impossible numbers ──
    Object.entries(secs).forEach(([sec, vals]) => {
      Object.entries(vals).forEach(([label, v]) => {
        allVals.push({ sec, label, v });
        if (label === 'pH' && (v < 0 || v > 14)) add('PH_IMPOSSIBLE', name, `${sec} pH ${v}`);
        else if (v < 0 && label !== 'LSI' && label !== 'Temperature') add('NEGATIVE', name, `${sec} ${label} ${v}`.trim());
      });
      const th = vals['Total Hardness'], ca = vals['Ca Hardness'], tds = vals['TDS'];
      if (isFinite(ca) && isFinite(th) && ca > th) add('CA_ABOVE_TH', name, `${sec}: Ca ${ca} > TH ${th}`);
      if (isFinite(th) && isFinite(tds) && tds > 0 && th > tds) add('TH_ABOVE_TDS', name, `${sec}: TH ${th} > TDS ${tds}`);
      const cond = vals['Conductivity'];
      if (isFinite(tds) && isFinite(cond) && tds > 0 && cond > 0) {
        const ratio = tds / cond;
        if (ratio < 0.4 || ratio > 0.95) add('TDS_COND_RATIO', name, `${sec}: TDS ${tds}, conductivity ${cond}`);
      }
    });

    if (sys.type === 'boiler') {
      const p = get('Boiler Water', 'P-Alkalinity'), m = get('Boiler Water', 'M-Alkalinity');
      if (isFinite(p) && isFinite(m) && p > m) add('P_ABOVE_M', name, `P ${p} > M ${m}`);
      const bw = get('Boiler Water', 'TDS'), fw = get('Feed Water', 'TDS');
      if (isFinite(bw) && isFinite(fw) && bw < fw) add('BOILER_BELOW_FEED', name, `boiler ${bw} < feed ${fw}`);
    }

    if (sys.type === 'cooling') {
      const ct = get('Circuit Water', 'TDS'), mt = get('Make-up Water', 'TDS');
      const cc = get('Circuit Water', 'Chloride'), mc = get('Make-up Water', 'Chloride');
      if ((isFinite(ct) && isFinite(mt) && ct < mt) || (isFinite(cc) && isFinite(mc) && cc < mc)) {
        add('CIRCUIT_BELOW_MU', name, isFinite(ct) && isFinite(mt) && ct < mt
          ? `TDS circuit ${ct} < make-up ${mt}` : `chloride circuit ${cc} < make-up ${mc}`);
      }
      if ([ct, mt, cc, mc].every(isFinite) && mt > 0 && mc > 0) {
        const byTds = ct / mt, byCl = cc / mc;
        const diff = Math.abs(byTds - byCl) / Math.max(byTds, byCl);
        if (diff > 0.3) add('CYCLES_DISAGREE', name, `by TDS ${byTds.toFixed(1)}, by chloride ${byCl.toFixed(1)}`);
      }
    }

    // ── copied or hurried ──
    const prev = earlier.map(o => auditSystems(o).find(s => sameSystem(s, sys))).find(Boolean);
    if (prev) {
      const ps = auditSections(prev);
      const shared = allVals.filter(x => ps[x.sec] && isFinite(ps[x.sec][x.label]));
      if (shared.length >= 3 && shared.every(x => ps[x.sec][x.label] === x.v)) {
        add('SAME_AS_LAST', name, `${shared.length} readings`);
      }
    }

    const measured = allVals.filter(x => {
      const d = auditDefFor(sys.type, x.label, x.sec);
      return !(d && d.calc);
    });
    if (measured.length >= 6) {
      // Round: a whole number ending in 0, or a small whole number (a
      // hardness of 2 is just as likely read as made up).
      const round = measured.filter(x => x.label !== 'pH' && Number.isInteger(x.v) && (x.v % 10 === 0 || x.v < 10));
      const nonPh = measured.filter(x => x.label !== 'pH');
      if (nonPh.length >= 5 && round.length / nonPh.length >= 0.9) add('ROUND_NUMBERS', name, `${round.length} of ${nonPh.length}`);
    }
    if (measured.length > 0 && measured.length < 3) add('THIN_SYSTEM', name, `${measured.length} reading${measured.length > 1 ? 's' : ''}`);

    const out = allVals.filter(x => {
      const d = auditDefFor(sys.type, x.label, x.sec);
      return d && typeof paramMark === 'function' && paramMark(d, x.v).glyph;
    });
    if (out.length && !String(sys.recommendations || '').trim()) {
      add('OUT_NO_ADVICE', name, out.map(x => x.label).slice(0, 4).join(', '));
    }

    (Array.isArray(sys.treatment) ? sys.treatment : []).forEach(tp => {
      if (tp && tp.product && String(tp.stock ?? '').trim() === '') add('NO_STOCK', name, tp.product);
    });
  });

  if (!readingsInReport) add('EMPTY_REPORT', '', '');

  // ── place and time ──
  const here = (isFinite(report.gps_lat) && isFinite(report.gps_lng) && report.gps_lat !== null)
    ? { lat: +report.gps_lat, lng: +report.gps_lng } : null;
  if (!here) {
    if (report.role !== 'office') add('NO_LOCATION', '', '');
  } else {
    const spots = earlier.filter(o => o.gps_lat != null && o.gps_lng != null)
      .map(o => ({ lat: +o.gps_lat, lng: +o.gps_lng }));
    if (spots.length >= 2) {
      // The client's usual spot: the median of earlier visits.
      const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
      const usual = { lat: med(spots.map(s => s.lat)), lng: med(spots.map(s => s.lng)) };
      const km = auditKm(here, usual);
      if (km > AUDIT.FAR_KM) add('FAR_FROM_SITE', '', `${km.toFixed(1)} km away`);
    }
  }

  const engKey = report.engineer_id || report.eng_code;
  if (engKey && t) {
    const near = (all || []).find(o => o !== report
      && (o.id || o.ref) !== (report.id || report.ref)
      && (o.engineer_id || o.eng_code) === engKey
      && clientKey(o) !== clientKey(report)
      && Math.abs(auditTime(o) - t) < AUDIT.TOO_CLOSE_MIN * 60000);
    if (near) {
      const mins = Math.round(Math.abs(auditTime(near) - t) / 60000);
      add('TOO_CLOSE_IN_TIME', '', `${mins} min from ${near.client_name || near.ref}`);
    }
  }

  const cost = flags.reduce((n, f) => n + f.cost, 0);
  return { score: Math.max(0, 100 - cost), flags };
}

function needsReview(audit, report) {
  return audit.score < AUDIT.REVIEW_BELOW
      || audit.flags.some(f => f.sev === 'high')
      || auditSampled(report);
}

// ── the scorecard ─────────────────────────────────────────────
// For one month. `reports` is every report; `clients` the active
// clients with engineer_id / team_id / frequency; `engineers` the
// engineers; `teams` [{ id, members: [engineer ids] }]; `reviews`
// { report_id: { status: 'approved' | 'attention' } }.

function monthOf(r) {
  const d = new Date(auditTime(r));
  return { y: d.getFullYear(), m: d.getMonth() };
}

function scorecard({ reports, clients, engineers, teams, reviews, year, month }) {
  const inMonth = (r) => { const d = monthOf(r); return d.y === year && d.m === month; };
  const monthReports = reports.filter(inMonth);
  const audits = new Map(monthReports.map(r => [r, auditReport(r, reports)]));
  const teamsOf = (engId) => (teams || []).filter(t => (t.members || []).includes(engId)).map(t => t.id);

  // Service visits this month, per client.
  const visits = {};
  monthReports.forEach(r => {
    if (r.visit_mode !== 'service') return;
    const k = clientKey(r);
    if (k) visits[k] = (visits[k] || 0) + 1;
  });

  return (engineers || [])
    .filter(e => e.active !== false)
    .map(e => {
      const mine = monthReports.filter(r => (r.engineer_id || r.eng_code) === (e.id || e.code));
      if (e.role === 'admin' && !mine.length) return null;

      // Coverage: the clients this engineer answers for, alone or in a team.
      const myTeams = teamsOf(e.id);
      const owned = (clients || []).filter(c => c.active !== false && !c.is_prospect &&
        (c.engineer_id === e.id || (c.team_id && myTeams.includes(c.team_id))));
      let due = 0, done = 0;
      const overdue = [];
      owned.forEach(c => {
        const need = VISITS_PER_MONTH[c.frequency] || 1;
        const got = Math.min(visits[c.id] || visits[c.code] || 0, need);
        due += need; done += got;
        if (got < need) overdue.push(c.name);
      });
      const coverage = due ? Math.round(100 * done / due) : null;
      // Nobody to answer for and nothing filed: not a row worth reading.
      // An engineer with clients and no reports still appears — that is
      // exactly what the scorecard is for.
      if (!mine.length && !owned.length) return null;

      const scores = mine.map(r => audits.get(r).score);
      const quality = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const highFlagged = mine.filter(r => audits.get(r).flags.some(f => f.sev === 'high')).length;
      const copied = mine.filter(r => audits.get(r).flags.some(f => f.code === 'SAME_AS_LAST')).length;

      let approved = 0, attention = 0;
      mine.forEach(r => {
        const rv = reviews && reviews[r.id];
        if (rv && rv.status === 'approved') approved++;
        if (rv && rv.status === 'attention') attention++;
      });
      const review = (approved + attention) ? Math.round(100 * approved / (approved + attention)) : null;

      // Weighted over whichever parts exist this month.
      const parts = [[coverage, AUDIT.WEIGHT_COVERAGE], [quality, AUDIT.WEIGHT_QUALITY], [review, AUDIT.WEIGHT_REVIEW]]
        .filter(([v]) => v !== null);
      const w = parts.reduce((n, [, x]) => n + x, 0);
      const overall = w ? Math.round(parts.reduce((n, [v, x]) => n + v * x, 0) / w) : null;

      return {
        id: e.id, code: e.code, name: e.name, role: e.role,
        reports: mine.length, due, done, coverage, overdue,
        quality, highFlagged, copied, approved, attention, review, overall,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
}

if (typeof module !== 'undefined') {
  module.exports = { RULES, AUDIT, auditReport, needsReview, auditSampled, scorecard };
}
