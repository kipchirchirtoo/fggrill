// ─── DOCUMENTATION CONTENT FUNCTIONS ────────────────────────────────────────
// Plain TypeScript (not TSX) — HTML strings are safe here without JSX parsing.

const DATE_STR = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long' });

function coverPage(badge: string, title: string, subtitle: string, desc: string, confidential = 'Confidential — For Authorized Personnel Only'): string {
    return `
<div class="cover">
  <div>
    <div class="cover-logo">Famous Gates Hotels &amp; Resorts — Employee Training Guide</div>
    <div class="cover-badge">${badge}</div>
    <div class="cover-title">${title}</div>
    <div class="cover-divider"></div>
    <div class="cover-subtitle">${subtitle}</div>
    <div class="cover-desc">${desc}</div>
  </div>
  <div class="cover-footer">
    <div class="cover-footer-left">${confidential}<br>Version 2.0 &nbsp;|&nbsp; ${DATE_STR}</div>
    <div class="cover-footer-right">
      <div class="hirall-brand">HIRALL SOLUTIONS</div>
      <div class="hirall-sub">+254 710 944 249 &nbsp;|&nbsp; admin@hirall.com &nbsp;|&nbsp; www.hirall.com</div>
    </div>
  </div>
</div>`;
}
