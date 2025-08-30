// js/content.js

// --- Hjelper: sett hero-bakgrunn (bruker CSS-fallback om bilde mangler)
function setHeroBackground(selector, imageUrl) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (imageUrl && String(imageUrl).trim() !== "") {
    el.style.backgroundImage = `url("${imageUrl}")`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Finn hvilken side vi er på (fra <body data-page="...">)
  const page = document.body?.dataset?.page || ''; // "home", "about" eller "services"

  // Koble side -> JSON-fil
  const urlMap = {
    home: '/data/home.json',
    about: '/data/about.json',
    services: '/data/services.json'
  };
  const jsonUrl = urlMap[page];

  try {
    // --- Last side-spesifikk JSON (tittel, undertittel, hero-bilde + innhold)
    let data = {};
    if (jsonUrl) {
      const res = await fetch(jsonUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    }

    // --- Sett hero-tekster om elementer finnes
    const heroTitleEl = document.getElementById('heroTitle');
    const heroSubtitleEl = document.getElementById('heroSubtitle');
    if (heroTitleEl && data.title) heroTitleEl.textContent = data.title;
    if (heroSubtitleEl && data.subtitle) heroSubtitleEl.textContent = data.subtitle;

    // --- Sett hero-bilde (bruk CSS-fallback hvis ikke satt)
    const heroSelector =
      page === 'home'     ? '.home-hero' :
      page === 'about'    ? '.about-hero' :
      page === 'services' ? '.services-hero' :
      null;
    if (heroSelector) setHeroBackground(heroSelector, data.hero_image);

    // --- Render tjenester/sekjoner på /services
    if (page === 'services') {
      renderServices(data);
    }
  } catch (err) {
    console.error('Kunne ikke laste inn side-data:', err);
  }

  // --- Hent felles site-data (orgnr, footer-tekst)
  try {
    const res = await fetch('/data/site.json', { cache: 'no-store' });
    if (res.ok) {
      const site = await res.json();
      const org = document.getElementById('orgnr');
      const ft  = document.getElementById('footerText');
      if (org && site.orgnr) org.textContent = site.orgnr;
      if (ft  && site.footer) ft.textContent = site.footer;
    }
  } catch (e) {
    // stille fallback
  }

  // --- Sett årstall om #year finnes
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});

// ------------------------
//  Render-funksjoner
// ------------------------
function renderServices(data) {
  const container = document.querySelector('.container');
  if (!container) return;

  // Støtt begge formater: sections[] og services[]
  const list =
    (Array.isArray(data.sections) ? data.sections : null) ||
    (Array.isArray(data.services) ? data.services : null) ||
    [];

  if (!list.length) {
    const p = document.createElement('p');
    p.textContent = 'Ingen tjenester publisert ennå.';
    container.appendChild(p);
    return;
  }

  list.forEach(item => {
    const h   = item.heading || item.title || item.tittel || '';
    const b   = item.body    || item.text  || item.brodtekst || '';
    const img = item.image   || item.bilde || null;

    const section = document.createElement('section');
    section.className = 'service';
    section.innerHTML = `
      ${img ? `<img class="service-img" src="${img}" alt="">` : ''}
      ${h ? `<h2>${h}</h2>` : ''}
      ${b ? `<p>${b}</p>` : ''}
    `;
    container.appendChild(section);
  });
}
