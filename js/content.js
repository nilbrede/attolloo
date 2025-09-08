// js/content.js

// Sett hero-bakgrunn (bruk CSS-fallback hvis bilde mangler)
function setHeroBackground(selector, imageUrl) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (imageUrl && String(imageUrl).trim() !== "") {
    el.style.backgroundImage = `url("${imageUrl}")`;
  }
}

// Render felles kort-seksjoner (gjenbrukes på home, about, services)
function renderSections(list) {
  const container = document.querySelector('.container');
  if (!container) return;

  const items = Array.isArray(list) ? list : [];

  if (!items.length) {
    const p = document.createElement('p');
    p.textContent = 'Ingen innhold publisert ennå.';
    container.appendChild(p);
    return;
  }

  items.forEach(item => {
    const h = item.heading || item.title || item.tittel || '';
    const b = item.body || item.text || item.brodtekst || '';
    const img = item.image || item.bilde || null;
    const tall = item.imageTall ? 'tall' : '';

    const section = document.createElement('section');
    section.className = 'service';

    section.innerHTML = `
  ${img ? `<img class="service-img ${tall}" src="${img}" alt="">` : ''}
  ${h ? `<h2>${h}</h2>` : ''}
  ${b ? `<p class="preserve-newlines">${b.replace(/\n/g, '<br>')}</p>` : ''}
`;

    container.appendChild(section);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Finn hvilken side vi er på via data-attributt på <body>
  const page = document.body.dataset.page; // "home" | "about" | "services"

  // Koble side -> JSON-fil
  const urlMap = {
    home:     '/data/home.json',
    about:    '/data/about.json',
    services: '/data/services.json'
  };
  const jsonUrl = urlMap[page];

  // Sett årstall i footer hvis finnes
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  try {
    if (!jsonUrl) return;

    const res = await fetch(jsonUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Sett hero-tekster
    if (data.title)    (document.getElementById('heroTitle')    || {}).textContent = data.title;
    if (data.subtitle) (document.getElementById('heroSubtitle') || {}).textContent = data.subtitle;

    // Sett hero-bilde (fallback styres i CSS)
    const heroSelector =
      page === 'home'     ? '.home-hero' :
      page === 'about'    ? '.about-hero' :
      /* services */         '.services-hero';
    setHeroBackground(heroSelector, data.hero_image);

    // Render innhold under hero
    if (page === 'services') {
      // Støtter både services[] og sections[] for fleksibilitet
      renderSections(data.services || data.sections);
    } else {
      renderSections(data.sections);
    }

    // (Valgfritt) hent felles footer-data
    try {
      const siteRes = await fetch('/data/site.json', { cache: 'no-cache' });
      if (siteRes.ok) {
        const site = await siteRes.json();
        const orgEl = document.getElementById('orgnr');
        const ftEl  = document.getElementById('footerText');
        if (orgEl && site.orgnr) orgEl.textContent = site.orgnr;
        if (ftEl  && site.footer) ftEl.textContent = site.footer;
      }
    } catch (_) { /* stille */ }

  } catch (err) {
    console.error('Kunne ikke laste inn side-data:', err);
  }
});
