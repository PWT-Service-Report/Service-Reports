// ══════════════════════════════════════════════════════════════
//  Krenos — water analysis limits
// ══════════════════════════════════════════════════════════════
//  The single definition of what every parameter is and what counts
//  as acceptable. The app and the dashboard both load this file.
//
//  It exists because they used to carry a copy each: the app was
//  updated to BS 2486 and the dashboard was not, so the same chloride
//  reading passed on the client's report and showed red to the office.
//  A limit changed here changes in both places, or in neither.
//
//  Limits follow the PWT treatment programme. See the project notes for
//  why boiler chloride carries none.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
const PARAMS = {
  boiler: {
    icon: '🔥', label: 'Boiler',
    sections: [
      { title: 'Softener Water', params: [
        { id:'sw_ph',   label:'pH',             unit:'—',     min:6.5,  max:8.5  },
        { id:'sw_tds',  label:'TDS',            unit:'ppm',   min:0,    max:1000 },
        { id:'sw_hard', label:'Total Hardness', unit:'ppm',   min:0,    max:5    },
      ]},
      // M-Alkalinity dropped — PWT does not measure it on the feed.
      // Chloride carries no limit here: it is the denominator of the
      // cycles calculation, not something to control.
      { title: 'Feed Water', params: [
        { id:'fw_ph',   label:'pH',             unit:'—',     min:8.0,  max:9.5  },
        { id:'fw_tds',  label:'TDS',            unit:'ppm',   min:0,    max:500  },
        { id:'fw_hard', label:'Total Hardness', unit:'ppm',   min:0,    max:5    },
        { id:'fw_ca',   label:'Ca Hardness',    unit:'ppm',   min:0,    max:3    },
        { id:'fw_cl',   label:'Chloride',       unit:'ppm',   noLimit:true },
        { id:'fw_fe',   label:'Iron',           unit:'ppm',   min:0,    max:0.3  },
        { id:'fw_cl2',  label:'Free Chlorine',  unit:'ppm',   min:0,    max:0.1  },
        { id:'fw_deha', label:'DEHA',           unit:'ppm',   min:0.1,  max:1.0  },
        { id:'fw_cret', label:'Est. Condensate Return', unit:'%', calc:true, noLimit:true },
      ]},
      { title: 'Boiler Water', params: [
        { id:'bw_ph',   label:'pH',             unit:'—',     min:10.5, max:12.0 },
        { id:'bw_tds',  label:'TDS',            unit:'ppm',   min:0,    max:3500 },
        { id:'bw_palk', label:'P-Alkalinity',   unit:'ppm',   min:100,  max:600  },
        { id:'bw_malk', label:'M-Alkalinity',   unit:'ppm',   min:150,  max:800  },
        // BS 2486 sets a MINIMUM caustic alkalinity of 350; the old
        // 0–200 range had it inverted, so low readings were flagged high.
        { id:'bw_ohalk',label:'OH Alkalinity',  unit:'ppm',   min:100,  max:350, calc:true },
        // No limit — chloride in the boiler is the cycles indicator.
        { id:'bw_cl',   label:'Chloride',       unit:'ppm',   noLimit:true },
        { id:'bw_so3',  label:'Sulfite',        unit:'ppm',   min:20,   max:60   },
        { id:'bw_po4',  label:'Phosphate',      unit:'ppm',   min:20,   max:50   },
        { id:'bw_si',   label:'Silica',         unit:'ppm',   min:0,    max:150  },
        { id:'bw_tan',  label:'Tannin',         unit:'ppm',   min:100,  max:160  },
        { id:'bw_cyc',  label:'Cycles of Concentration', unit:'—', calc:true, noLimit:true },
      ]},
      { title: 'Condensate Return', params: [
        { id:'cr_ph',   label:'pH',             unit:'—',     min:8.3,  max:9.5  },
        { id:'cr_cond', label:'Conductivity',   unit:'µS/cm', min:0,    max:20   },
        { id:'cr_fe',   label:'Iron',           unit:'ppm',   min:0,    max:0.1  },
      ]},
    ]
  },
  cooling: {
    icon: '❄️', label: 'Cooling Tower',
    sections: [
      { title: 'Make-up Water', params: [
        { id:'mu_ph',   label:'pH',             unit:'—',     min:6.5,  max:8.5  },
        { id:'mu_tds',  label:'TDS',            unit:'ppm',   min:0,    max:1000 },
        { id:'mu_hard', label:'Total Hardness', unit:'ppm',   min:0,    max:400  },
        { id:'mu_ca',   label:'Ca Hardness',    unit:'ppm',   min:0,    max:300  },
        { id:'mu_alk',  label:'M-Alkalinity',   unit:'ppm',   min:0,    max:300  },
        { id:'mu_cl',   label:'Chloride',       unit:'ppm',   min:0,    max:200  },
      ]},
      { title: 'Circuit Water', params: [
        { id:'cw_temp', label:'Temperature',    unit:'°C',    min:20,   max:50   },
        { id:'cw_ph',   label:'pH',             unit:'—',     min:7.0,  max:9.0  },
        { id:'cw_cond', label:'Conductivity',   unit:'µS/cm', min:0,    max:3000 },
        { id:'cw_tds',  label:'TDS',            unit:'ppm',   min:0,    max:2000 },
        { id:'cw_hard', label:'Total Hardness', unit:'ppm',   min:0,    max:800  },
        { id:'cw_ca',   label:'Ca Hardness',    unit:'ppm',   min:0,    max:600  },
        { id:'cw_alk',  label:'M-Alkalinity',   unit:'ppm',   min:0,    max:600  },
        { id:'cw_cl',   label:'Chloride',       unit:'ppm',   min:0,    max:500  },
        { id:'cw_fcl',  label:'Free Chlorine',  unit:'ppm',   min:0.2,  max:1.0  },
        { id:'cw_fe',   label:'Iron',           unit:'ppm',   min:0,    max:1.0  },
        { id:'cw_zn',   label:'Zinc',           unit:'ppm',   min:0,    max:2.0  },
        { id:'cw_opo4', label:'Ortho-Phosphate',unit:'ppm',   min:0,    max:10   },
        { id:'cw_tpo4', label:'Total Phosphate',unit:'ppm',   min:0,    max:15   },
        { id:'cw_phos', label:'Phosphonate',    unit:'ppm',   min:0,    max:10   },
        { id:'cw_lsi',  label:'LSI',            unit:'—',     min:-0.5, max:0.5, calc:true },
      ]},
    ]
  },
  closed: {
    icon: '🔄', label: 'Closed Loop',
    sections: [
      { title: 'Closed Loop Parameters', params: [
        { id:'cl_ph',   label:'pH',             unit:'—',     min:8.0,  max:10.0 },
        { id:'cl_cond', label:'Conductivity',   unit:'µS/cm', min:0,    max:3000 },
        { id:'cl_hard', label:'Total Hardness', unit:'ppm',   min:0,    max:200  },
        { id:'cl_fe',   label:'Iron',           unit:'ppm',   min:0,    max:1.0  },
        { id:'cl_inh',  label:'Inhibitor Level',unit:'ppm',   min:1000, max:1600 },
        { id:'cl_turb', label:'Turbidity',      unit:'NTU',   min:0,    max:5    },
      ]},
    ]
  },
  pool: {
    icon: '🏊', label: 'Swimming Pool',
    sections: [
      { title: 'Pool Water Analysis', params: [
        { id:'pl_fcl',  label:'Free Chlorine',   unit:'ppm',   min:1,    max:3    },
        { id:'pl_ph',   label:'pH',              unit:'—',     min:7.2,  max:7.8  },
        { id:'pl_cya',  label:'Cyanuric Acid',   unit:'ppm',   min:30,   max:70   },
        { id:'pl_alk',  label:'Total Alkalinity',unit:'ppm',   min:100,  max:150  },
        { id:'pl_ca',   label:'Calcium Hardness',unit:'ppm',   min:100,  max:400  },
        { id:'pl_tds',  label:'TDS',             unit:'ppm',   min:0,    max:1500 },
      ]},
    ]
  },
  raw: {
    icon: '🚰', label: 'Raw Water',
    sections: [
      { title: 'Raw Water Analysis', params: [
        { id:'rw_ph',   label:'pH',             unit:'—',     min:6.5,  max:8.5  },
        { id:'rw_tds',  label:'TDS',            unit:'ppm',   min:0,    max:1000 },
        { id:'rw_hard', label:'Total Hardness', unit:'ppm',   min:0,    max:500  },
        { id:'rw_ca',   label:'Ca Hardness',    unit:'ppm',   min:0,    max:400  },
        { id:'rw_alk',  label:'M-Alkalinity',   unit:'ppm',   min:0,    max:400  },
        { id:'rw_turb', label:'Turbidity',      unit:'NTU',   min:0,    max:10   },
        { id:'rw_fe',   label:'Iron',           unit:'ppm',   min:0,    max:0.3  },
        { id:'rw_cl2',  label:'Free Chlorine',  unit:'ppm',   min:0,    max:1.0  },
        { id:'rw_so4',  label:'Sulfate',        unit:'ppm',   min:0,    max:400  },
        { id:'rw_si',   label:'Silica',         unit:'ppm',   min:0,    max:50   },
      ]},
    ]
  }
};

// ══════════════════════════════════════════
//  HOW A READING IS MARKED
// ══════════════════════════════════════════
// One rule for the whole system: a mark means a problem, and its shape
// says which way. A page of green ticks would bury the one reading that
// needs attention, and a triangle survives a black-and-white print and
// a colour-blind reader in a way a coloured dot does not.
const MARK_BAD = '#8a3a08';
const MARK_OK  = '#141414';

function paramMark(p, numV) {
  if (isNaN(numV))  return { glyph: '', color: MARK_OK };
  if (p.noLimit)    return { glyph: '', color: MARK_OK };

  const hasMin = isFinite(p.min);
  const hasMax = isFinite(p.max) && p.max < 9999;
  if (!hasMin && !hasMax) return { glyph: '', color: MARK_OK };

  if (hasMax && numV > p.max) return { glyph: '▲', color: MARK_BAD };
  if (hasMin && numV < p.min) return { glyph: '▼', color: MARK_BAD };
  return { glyph: '', color: MARK_OK };
}

// Does this parameter have a band to judge against at all? The old test
// was `max < 9999`, which only worked while "no limit" was written as a
// fake ceiling of 9999. It is now written as noLimit, and this is the
// one place that question is answered.
function paramHasBand(p) {
  if (!p || p.noLimit) return false;
  return isFinite(p.min) || (isFinite(p.max) && p.max < 9999);
}

// The band in words, for a legend or a table cell.
function paramRangeText(p) {
  if (!paramHasBand(p)) return '—';
  const lo = isFinite(p.min) ? p.min : null;
  const hi = isFinite(p.max) && p.max < 9999 ? p.max : null;
  if (lo !== null && hi !== null) return lo + ' – ' + hi;
  if (hi !== null) return 'max ' + hi;
  if (lo !== null) return 'min ' + lo;
  return '—';
}
