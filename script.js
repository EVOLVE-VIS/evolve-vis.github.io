/* ===========================================================
   EVOLVE — project page interactions
   =========================================================== */

/* ---------- HiFiC-style image comparison slider ---------- */
class CompareSlider {
  constructor(el){
    this.el = el;
    this.pos = 50;
    el.classList.add('is-loading');
    el.innerHTML = `
      <img class="compare__img compare__img--after"  alt="reconstruction">
      <img class="compare__img compare__img--before" alt="reference">
      <span class="compare__label compare__label--left">${el.dataset.left || 'GT'}</span>
      <span class="compare__label compare__label--right">${el.dataset.right || 'EVOLVE'}</span>
      <div class="compare__handle">
        <button class="compare__grip" aria-label="Drag to compare"><span>◄</span><span>►</span></button>
      </div>`;
    this.after   = el.querySelector('.compare__img--after');
    this.before  = el.querySelector('.compare__img--before');
    this.handle  = el.querySelector('.compare__handle');
    this.lblL    = el.querySelector('.compare__label--left');
    this.lblR    = el.querySelector('.compare__label--right');

    if (el.dataset.before) this.load(el.dataset.before, el.dataset.after);
    this.bind();
    this.apply();
  }

  setLabels(l, r){ this.lblL.innerHTML = l; this.lblR.innerHTML = r; }

  load(beforeSrc, afterSrc){
    this.el.classList.add('is-loading');
    let pending = 2;
    const done = () => { if(--pending === 0) this.el.classList.remove('is-loading'); };
    const tmp = new Image();
    tmp.onload = () => { this.el.style.aspectRatio = `${tmp.naturalWidth} / ${tmp.naturalHeight}`; };
    tmp.src = beforeSrc;
    this.before.onload = done; this.after.onload = done;
    this.before.onerror = done; this.after.onerror = done;
    this.before.src = beforeSrc;
    this.after.src  = afterSrc;
    this.set(50);
  }

  bind(){
    const move = (clientX) => {
      const r = this.el.getBoundingClientRect();
      this.set(((clientX - r.left) / r.width) * 100);
    };
    const down = (e) => {
      e.preventDefault();
      const mv = (ev) => move((ev.touches ? ev.touches[0] : ev).clientX);
      const up = () => {
        window.removeEventListener('mousemove', mv);
        window.removeEventListener('touchmove', mv);
        window.removeEventListener('mouseup', up);
        window.removeEventListener('touchend', up);
      };
      window.addEventListener('mousemove', mv);
      window.addEventListener('touchmove', mv, {passive:true});
      window.addEventListener('mouseup', up);
      window.addEventListener('touchend', up);
      mv(e);
    };
    this.el.addEventListener('mousedown', down);
    this.el.addEventListener('touchstart', down, {passive:false});
    this.handle.querySelector('.compare__grip').addEventListener('keydown', (e) => {
      if(e.key === 'ArrowLeft')  this.set(this.pos - 3);
      if(e.key === 'ArrowRight') this.set(this.pos + 3);
    });
  }

  set(p){ this.pos = Math.max(0, Math.min(100, p)); this.apply(); }
  apply(){
    this.before.style.clipPath = `inset(0 ${100 - this.pos}% 0 0)`;
    this.handle.style.left = `${this.pos}%`;
  }
}

const fmt = (n) => n.toLocaleString('en-US');

/* ===========================================================
   Reusable comparison gallery
   =========================================================== */
function setupGallery(cfg){
  const $ = id => document.getElementById(id);
  const slider  = new CompareSlider($(cfg.compare));
  const dsWrap  = $(cfg.dsChips), lWrap = $(cfg.leftChips), rWrap = $(cfg.rightChips);
  const diffBtn = $(cfg.diffToggle), caption = $(cfg.caption);
  const metricL = $(cfg.metricL), metricR = $(cfg.metricR);
  const modeTabsEl = cfg.modeTabs ? $(cfg.modeTabs) : null;
  const single  = !modeTabsEl;

  let mode  = cfg.defaults.mode || 'vol';
  let ds    = cfg.defaults.ds;
  let left  = cfg.defaults.left;
  let right = cfg.defaults.right;
  let diff  = false;

  const modeLabel = () => single ? cfg.modeLabel : cfg.modes[mode];

  function path(m){
    const k = cfg.keyMap[m];
    const stem = single ? `${ds}_${k}` : `${mode}_${ds}_${k}`;
    return `${cfg.base}${stem}${(diff && m !== 'GT') ? '_diff' : ''}.webp`;
  }
  function labelFor(m){
    if (m === 'GT') return 'Ground Truth';
    if (diff) return `${m} error`;
    return `${m} · ${fmt(cfg.metrics[ds][m][1])}×`;
  }
  function setMetric(el, m){
    const nameEl = el.querySelector('.metric__name');
    const valEl  = el.querySelector('.metric__val');
    nameEl.textContent = m === 'GT' ? 'Ground Truth' : m;
    el.classList.toggle('is-gt', m === 'GT');
    if (m === 'GT'){
      valEl.innerHTML = 'original · lossless';
    } else {
      const [psnr, cr] = cfg.metrics[ds][m];
      valEl.innerHTML =
        `<b class="m-psnr">${psnr.toFixed(2)}</b><small>dB&nbsp;PSNR</small><i></i>` +
        `<b class="m-cr">${fmt(cr)}</b><small>compression&nbsp;ratio</small>`;
    }
  }
  function emphasize(){
    [metricL, metricR].forEach(el =>
      el.querySelectorAll('b').forEach(b => b.classList.remove('win', 'lose')));
    if (left === 'GT' || right === 'GT') return;
    const lv = cfg.metrics[ds][left], rv = cfg.metrics[ds][right];
    const mark = (sel, li, ri) => {
      const le = metricL.querySelector(sel), re = metricR.querySelector(sel);
      if (!le || !re) return;
      if (li > ri){ le.classList.add('win'); re.classList.add('lose'); }
      else if (ri > li){ re.classList.add('win'); le.classList.add('lose'); }
    };
    mark('.m-psnr', lv[0], rv[0]);
    mark('.m-cr',   lv[1], rv[1]);
  }

  function render(){
    const dsName = cfg.datasets.find(d => d[0] === ds)[1];
    slider.load(path(left), path(right));
    slider.setLabels(labelFor(left), labelFor(right));
    setMetric(metricL, left);
    setMetric(metricR, right);
    emphasize();
    caption.textContent =
      `${dsName} · ${modeLabel()} · ${left} vs. ${right}${diff ? ' · error maps' : ''}`;
  }

  function chips(wrap, list, current, onPick){
    wrap.innerHTML = '';
    list.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (val === current ? ' is-active' : '');
      b.textContent = label;
      b.onclick = () => onPick(val);
      wrap.appendChild(b);
    });
  }
  const asPairs = arr => arr.map(v => [v, v]);
  function rebuildChips(){
    chips(dsWrap, cfg.datasets, ds, v => { ds = v; rebuildChips(); render(); });
    chips(lWrap, asPairs(cfg.methods), left,  v => { left  = v; rebuildChips(); render(); });
    chips(rWrap, asPairs(cfg.methods), right, v => { right = v; rebuildChips(); render(); });
  }
  rebuildChips();

  if (modeTabsEl){
    modeTabsEl.querySelectorAll('.tab').forEach(tab => {
      tab.onclick = () => {
        modeTabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        mode = tab.dataset.mode; render();
      };
    });
  }

  diffBtn.onclick = () => {
    diff = !diff;
    diffBtn.classList.toggle('is-on', diff);
    diffBtn.setAttribute('aria-checked', diff);
    render();
  };

  render();
}

/* ===========================================================
   Catalogues
   =========================================================== */
const MODES = { vol: 'volume rendering', iso: 'isosurface' };

/* ---- 04 · traditional compressors (Exp/exp1_result) ---- */
const TRAD = {
  compare:'galleryCompare', modeTabs:'modeTabs',
  dsChips:'dsChips', leftChips:'leftChips', rightChips:'rightChips',
  diffToggle:'diffToggle', caption:'galleryCaption',
  metricL:'metricL', metricR:'metricR',
  base:'assets/cmp/', modes:MODES,
  datasets:[['asteroid','Asteroid Impact'],['combustion','Combustion (Jet)'],
            ['ionization','Ionization (H⁺)'],['isotropic','Isotropic Turbulence']],
  methods:['GT','EVOLVE','SZ3','TTHRESH','ZFP'],
  keyMap:{GT:'gt',EVOLVE:'evolve',SZ3:'sz3',TTHRESH:'tthresh',ZFP:'zfp'},
  metrics:{
    asteroid:   { EVOLVE:[47.16,9803], SZ3:[40.85,2482], TTHRESH:[43.44,2401], ZFP:[40.00,1164] },
    combustion: { EVOLVE:[49.31,6047], SZ3:[41.10,2948], TTHRESH:[42.98,2714], ZFP:[41.92, 129] },
    ionization: { EVOLVE:[47.58,7843], SZ3:[41.43,1051], TTHRESH:[40.11,6334], ZFP:[41.44, 107] },
    isotropic:  { EVOLVE:[45.18,2846], SZ3:[40.03, 985], TTHRESH:[43.51, 870], ZFP:[43.79,  64] },
  },
  defaults:{ mode:'vol', ds:'asteroid', left:'EVOLVE', right:'ZFP' },
};

/* ---- 05 · learned / INR compressors (Exp/exp2_result) ---- */
const INR = {
  compare:'inrCompare', modeTabs:'inrModeTabs',
  dsChips:'inrDsChips', leftChips:'inrLeftChips', rightChips:'inrRightChips',
  diffToggle:'inrDiffToggle', caption:'inrCaption',
  metricL:'inrMetricL', metricR:'inrMetricR',
  base:'assets/inr/', modes:MODES,
  datasets:[['gas','Gas'],['magnetic','Magnetic Reconnection'],['half-cylinder','Half-Cylinder']],
  methods:['GT','EVOLVE','SIREN','NeurComp','ECNR','Instant-NGP','fV-SRN','AMGSRN++','IDLat'],
  keyMap:{GT:'gt',EVOLVE:'evolve',SIREN:'siren',NeurComp:'neurcomp',ECNR:'ecnr',
          'Instant-NGP':'ngp','fV-SRN':'fvsrn','AMGSRN++':'amgsrn',IDLat:'idlat'},
  metrics:{
    'half-cylinder':{ EVOLVE:[44.91,2596], SIREN:[40.44,633], NeurComp:[42.29,1044], ECNR:[41.50,446],
                      'Instant-NGP':[41.35,168], 'fV-SRN':[42.23,166], 'AMGSRN++':[40.90,371], IDLat:[42.17,1114] },
    magnetic:{ EVOLVE:[45.20,10774], SIREN:[42.09,5256], NeurComp:[43.48,6649], ECNR:[43.29,3047],
               'Instant-NGP':[43.91,1839], 'fV-SRN':[42.16,1813], 'AMGSRN++':[44.23,1575], IDLat:[38.84,3748] },
    gas:{ EVOLVE:[45.62,10517], SIREN:[41.37,1979], NeurComp:[41.56,5954], ECNR:[43.35,1714],
          'Instant-NGP':[42.22,1839], 'fV-SRN':[40.24,936], 'AMGSRN++':[40.78,1575], IDLat:[41.28,1808] },
  },
  defaults:{ mode:'vol', ds:'gas', left:'EVOLVE', right:'NeurComp' },
};

/* ---- 06 · out-of-domain scanned CT data (Exp/scan_exp) ---- */
const SCAN = {
  compare:'scanCompare', modeTabs:null, modeLabel:'volume rendering',
  dsChips:'scanDsChips', leftChips:'scanLeftChips', rightChips:'scanRightChips',
  diffToggle:'scanDiffToggle', caption:'scanCaption',
  metricL:'scanMetricL', metricR:'scanMetricR',
  base:'assets/scan/',
  datasets:[['chameleon','Chameleon'],['stag_beetle','Stag Beetle'],['engine','Engine'],['foot','Foot']],
  methods:['GT','EVOLVE','SZ3','TTHRESH','ZFP'],
  keyMap:{GT:'gt',EVOLVE:'evolve',SZ3:'sz3',TTHRESH:'tthresh',ZFP:'zfp'},
  metrics:{
    chameleon:  { EVOLVE:[49.64,728],  SZ3:[46.22,702],  TTHRESH:[43.46,80],  ZFP:[43.72,127] },
    stag_beetle:{ EVOLVE:[50.54,3830], SZ3:[44.67,1061], TTHRESH:[44.94,50],  ZFP:[42.92,920] },
    engine:     { EVOLVE:[44.08,327],  SZ3:[43.50,100],  TTHRESH:[43.45,103], ZFP:[43.13,79]  },
    foot:       { EVOLVE:[33.71,257],  SZ3:[45.59,35],   TTHRESH:[45.68,20],  ZFP:[44.11,29]  },
  },
  defaults:{ ds:'chameleon', left:'EVOLVE', right:'SZ3' },
};

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {

  new CompareSlider(document.getElementById('heroCompare'));

  setupGallery(TRAD);
  setupGallery(INR);
  setupGallery(SCAN);

  // copy bibtex
  const copyBtn = document.getElementById('copyBib');
  if (copyBtn) copyBtn.onclick = async () => {
    try{
      await navigator.clipboard.writeText(document.getElementById('bibText').textContent);
      copyBtn.textContent = 'Copied ✓'; copyBtn.classList.add('is-done');
      setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('is-done'); }, 1800);
    }catch(e){ copyBtn.textContent = 'Ctrl+C'; }
  };

  // reveals
  document.querySelectorAll('.hero .reveal[data-d]').forEach(el => {
    el.style.transitionDelay = `${(+el.dataset.d || 0) * 0.09}s`;
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:0.12});
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
});
