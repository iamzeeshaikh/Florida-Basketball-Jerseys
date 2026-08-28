// Build the BODIES of the product sections, not just their headings.
//
// The first pass filled the slots the original template marked "CHANGE THIS" —
// headings, intros, prose, tags. That took two product pages from 86.6% alike
// to 78.3%, and then stopped, because everything below those slots was still
// captured HTML shared by all 42 pages: 2,850 words each, against 782 that were
// actually about the product. Four blocks account for nearly all of it — the
// audience cards, the customization cards, the fabric panels and the size
// tables — so those are generated here, per product, from real facts.
//
// Card COUNTS vary too, and deliberately. A page that always renders six cards
// in the same grid reads as a template even when every word inside it differs;
// products that genuinely have four things to say about who they suit get four
// cards, and the ones with six get six.
//
// What is not invented: fabric weights, GSM figures and body measurements are
// specifications. Where two products share one, they share it. Differentiation
// comes from WHICH fabrics a product is offered in, which is recommended for
// it and why — not from writing a different number on the same cloth.

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CHECK_SM = '<svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK_LIST = '<svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// A small set of line-art marks, picked per card by index so neighbouring cards
// never repeat one. Purely decorative — every card is labelled in text too.
const ICONS = [
  '<path d="M11 2L2 7v2h18V7L11 2z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><path d="M5 9v8M9 9v8M13 9v8M17 9v8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2 17h18" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  '<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M11 3v16M3 11h16" stroke="currentColor" stroke-width="1.2"/>',
  '<path d="M11 2l2.5 7H21l-6 4.4 2.3 7L11 16.5l-6.3 3.9 2.3-7L1 9h7.5z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
  '<rect x="3" y="4" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M3 9h16M8 4v14" stroke="currentColor" stroke-width="1.2"/>',
  '<path d="M4 18V8l7-5 7 5v10" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><path d="M9 18v-5h4v5" stroke="currentColor" stroke-width="1.3"/>',
  '<circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="15" cy="14" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M8 11.5v3M11.5 14h0" stroke="currentColor" stroke-width="1.3"/>',
  '<path d="M3 11h16M11 3v16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="11" cy="11" r="8.5" stroke="currentColor" stroke-width="1.3" fill="none"/>',
  '<path d="M5 3h12v16l-6-4-6 4V3z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
  '<path d="M2 16l5-6 4 4 4-6 5 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
];
const icon = (i) => `<svg width="20" height="20" viewBox="0 0 22 22" fill="none">${ICONS[i % ICONS.length]}</svg>`;

// ── who this product is for ──────────────────────────────────────────────────
const FIT_LABEL = { perfect: 'Perfect Fit', good: 'Good Fit', consider: 'Worth Considering' };

export function renderAudience(cards) {
  return cards.map((c, i) => `
        <div class="fbj-pwb-card" role="listitem">
          <div class="fbj-pwb-card-band" aria-hidden="true"></div>
          <div class="fbj-pwb-card-body">
            <div class="fbj-pwb-card-head">
              <div class="fbj-pwb-card-icon" aria-hidden="true">${icon(i)}</div>
              <span class="fbj-pwb-card-fit-badge fbj-pwb-card-fit-badge--${esc(c.fit || 'perfect')}">${CHECK_SM}${esc(FIT_LABEL[c.fit] || FIT_LABEL.perfect)}</span>
            </div>
            <div class="fbj-pwb-card-title">${esc(c.title)}</div>
            <p class="fbj-pwb-card-desc">${c.desc}</p>
            <div class="fbj-pwb-card-list">${c.points.map((p) => `
              <div class="fbj-pwb-card-list-item">
                <div class="fbj-pwb-card-check" aria-hidden="true">${CHECK_LIST}</div>
                <span>${p}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>`).join('\n');
}

// ── what you can change on this product ──────────────────────────────────────
export function renderCustomization(cards) {
  return cards.map((c, i) => `
        <div class="fbj-pco-card" role="listitem">
          <div class="fbj-pco-card-head">
            <div class="fbj-pco-card-icon" aria-hidden="true">${icon(i + 2)}</div>
            ${c.free === false ? '' : `<span class="fbj-pco-free-badge">${CHECK_SM}Included Free</span>`}
          </div>
          <div class="fbj-pco-card-title">${esc(c.title)}</div>
          <p class="fbj-pco-card-desc">${c.desc}</p>
          <div class="fbj-pco-card-options">${c.options.map((o) => `
            <span class="fbj-pco-card-opt">${esc(o)}</span>`).join('')}
          </div>
        </div>`).join('\n');
}

// ── which fabrics this product is offered in ─────────────────────────────────
//
// The catalogue of fabrics is fixed — these are real materials with real
// weights — so the differentiation here is honest selection rather than
// invented specification: a mesh short is not offered in bonded reversible
// double-layer, and a reversible jersey is not offered in 125 GSM open mesh.
// Each product names the fabrics that actually apply to it, marks the one we
// recommend for it, and says in its own words why that one.
export const FABRICS = {
  sublimation: { id: 'sublimation', name: 'Sublimation Polyester', tag: '100% Polyester · Full-color print',
    badges: ['100% Polyester', '150-160 GSM', 'Florida-Ready'],
    specs: [['100%', 'Polyester'], ['155', 'GSM Weight'], ['4-way', 'Stretch'], ['UPF', '30+ Protection']] },
  mesh: { id: 'mesh', name: 'Athletic Mesh', tag: 'Open-weave · Maximum airflow',
    badges: ['100% Polyester', '120-130 GSM', 'Max Airflow'],
    specs: [['100%', 'Polyester'], ['125', 'GSM Weight'], ['Max', 'Airflow'], ['2-way', 'Stretch']] },
  wicking: { id: 'wicking', name: 'Moisture-Wicking Performance', tag: 'Sweat-pull technology · Lightweight',
    badges: ['92/8 Poly/Spandex', '140-150 GSM', 'Quick Dry'],
    specs: [['92/8', 'Poly/Spandex'], ['145', 'GSM Weight'], ['4-way', 'Stretch'], ['Quick', 'Dry Rate']] },
  reversible: { id: 'reversible', name: 'Reversible Double-Layer', tag: 'Two-sided · Home & away',
    badges: ['Double Layer', '240 Total GSM', 'Two-Sided'],
    specs: [['2', 'Full Designs'], ['240', 'Total GSM'], ['Bonded', 'Seam Type'], ['Both Sides', 'Printed']] },
};

export function renderFabricButtons(list, recommended) {
  return list.map((key) => {
    const f = FABRICS[key];
    const active = key === recommended;
    return `
          <button class="fbj-pfb-fab-btn${active ? ' fbj-pfb-fab-active' : ''}" onclick="fbj_pfb_select(this,'fbj-pfb-panel-${f.id}')" aria-pressed="${active}">
            <div class="fbj-pfb-fab-dot"></div>
            <div class="fbj-pfb-fab-btn-text">
              <div class="fbj-pfb-fab-name">${esc(f.name)}</div>
              <div class="fbj-pfb-fab-tag">${esc(f.tag)}</div>
            </div>
            ${active ? '<span class="fbj-pfb-fab-recommend">Recommended</span>' : ''}
          </button>`;
  }).join('\n');
}

const PRO_ICON = '<div class="fbj-pfb-pro-icon" aria-hidden="true"><svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';

/**
 * The detail panel behind each fabric button.
 *
 * `notes` carries the two things that are genuinely per-product: the paragraph
 * explaining what this fabric does FOR THIS GARMENT, and the three or four
 * short points beside it. The specs are not per-product — 155 GSM is 155 GSM on
 * a jersey and on a pair of shorts, and writing a different number would be
 * making one up.
 */
export function renderFabricPanels(list, recommended, notes) {
  return list.map((key) => {
    const f = FABRICS[key];
    const n = notes[key] || {};
    return `
        <div id="fbj-pfb-panel-${f.id}"${key === recommended ? '' : ' style="display:none"'}>
          <div class="fbj-pfb-detail-head">
            <div>
              <div class="fbj-pfb-detail-label">${esc(key === recommended ? 'Recommended Fabric' : 'Also Available')}</div>
              <div class="fbj-pfb-detail-name">${esc(f.name)}</div>
            </div>
            <div class="fbj-pfb-detail-badges">${(f.badges || []).map((b, i) => `
              <span class="fbj-pfb-badge fbj-pfb-badge--${['orange', 'blue', 'green'][i % 3]}">${esc(b)}</span>`).join('')}
            </div>
          </div>
          <div class="fbj-pfb-detail-body">
            <p class="fbj-pfb-detail-desc">${n.desc || ''}</p>
            <div class="fbj-pfb-stats" aria-label="Fabric specifications">${f.specs.map(([v, l]) => `
              <div class="fbj-pfb-stat">
                <div class="fbj-pfb-stat-val">${esc(v)}</div>
                <div class="fbj-pfb-stat-label">${esc(l)}</div>
              </div>`).join('')}
            </div>
            <div class="fbj-pfb-pros">${(n.pros || []).map((p) => `
              <div class="fbj-pfb-pro">${PRO_ICON}<span>${p}</span></div>`).join('')}
            </div>
          </div>
        </div>`;
  }).join('\n');
}

// ── size guide ───────────────────────────────────────────────────────────────
//
// Every product page carried all three tables — adult jerseys, youth jerseys
// and shorts — which is 476 identical words and, on a pair of shorts, two
// charts nobody on that page needs. A product now names the tables that apply
// to it. That is both the largest single cut in shared text and the more
// useful page: a shorts chart on a shorts page, and a jersey chart on a jersey.

const SIZE_TABS = {
  adult: { id: 'fbj-psg-adult', label: 'Adult Jerseys', badge: 'S – 5XL',
    icon: '<circle cx="7" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M2 13v-2a5 5 0 0110 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>' },
  youth: { id: 'fbj-psg-youth', label: 'Youth Jerseys', badge: 'XS – XL',
    icon: '<circle cx="7" cy="4.5" r="2" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M2.5 12.5v-2a4.5 4.5 0 019 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>' },
  shorts: { id: 'fbj-psg-shorts', label: 'Shorts', badge: 'XS – 5XL',
    icon: '<rect x="2.5" y="3" width="9" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M7 11v2" stroke="currentColor" stroke-width="1.3"/>' },
};

export function sizeTabIds() {
  return Object.values(SIZE_TABS).map((t) => t.id);
}

export function renderSizeTabs(tabs) {
  return tabs.map((key, i) => {
    const t = SIZE_TABS[key];
    if (!t) return '';
    return `
      <button class="fbj-psg-tab${i === 0 ? ' fbj-psg-tab-active' : ''}" onclick="fbj_psg_tab(this,'${t.id}')" role="tab" aria-selected="${i === 0}">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">${t.icon}</svg>
        ${esc(t.label)}
        <span class="fbj-psg-tab-badge">${esc(t.badge)}</span>
      </button>`;
  }).join('\n');
}

/** How to measure — the steps that matter for THIS garment. */
export function renderMeasure(cards) {
  return cards.map((c, i) => `
      <div class="fbj-psg-measure-card">
        <div class="fbj-psg-measure-head">
          <div class="fbj-psg-measure-icon" aria-hidden="true">${icon(i + 4)}</div>
          <div class="fbj-psg-measure-title">${esc(c.title)}</div>
        </div>
        <div class="fbj-psg-measure-steps">${c.steps.map((s, n) => `
          <div class="fbj-psg-measure-step">
            <div class="fbj-psg-measure-step-num" aria-hidden="true">${n + 1}</div>
            <span>${s}</span>
          </div>`).join('')}
        </div>
      </div>`).join('\n');
}

// ── how the garment is put together ──────────────────────────────────────────
export function renderConstruction(cards) {
  return cards.map((c, i) => `
      <div class="fbj-pfb-con-card" role="listitem">
        <div class="fbj-pfb-con-icon" aria-hidden="true">${icon(i + 1)}</div>
        <div class="fbj-pfb-con-title">${esc(c.title)}</div>
        <p class="fbj-pfb-con-body">${c.body}</p>
      </div>`).join('\n');
}

// ── looking after it ─────────────────────────────────────────────────────────
const CARE_DO = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CARE_DONT = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function renderCare(items) {
  return items.map((c) => `
          <div class="fbj-pfb-care-item">
            <div class="fbj-pfb-care-item-icon fbj-pfb-care-item-icon--${c.dont ? 'dont' : 'do'}" aria-hidden="true">${c.dont ? CARE_DONT : CARE_DO}</div>
            <div class="fbj-pfb-care-item-text">${c.text}</div>
          </div>`).join('');
}
