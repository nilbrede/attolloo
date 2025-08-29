// js/content.js

// Setter hero-bakgrunn (bruker CSS-fallback hvis bilde mangler)
function setHeroBackground(selector, imageUrl) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (imageUrl && imageUrl.trim() !== "") {
    el.style.backgroundImage = `url("${imageUrl}")`;
  }
  // Hvis imageUrl ikke er satt, brukes fallback fra CSS (.home-hero / .about-hero / .services-hero)
}

document.addEventListener('DOMContentLoaded', async () => {
  // Finn hvilken side vi er på (satt i <body data-page="...">)
  const page = document.body.dataset.page; // "home", "about" eller "services"

  // Koble side -> JSON-fil
  const urlMap = {
    home:     '/data/home.json',
    about:    '/data/about.json',
    services: '/data/services.json',
  };

  const jsonUrl = urlMap[page];

  // Last inn side-spesifikk JSON (tittel, undertittel, hero-bilde)
  if (jsonUrl) {
    try {
      const res  = await fetch(jsonUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Sett hero-tekster
      if (data.title)    document.getElementById('heroTitle').textContent    = data.title;
      if (data.subtitle) document.getElementById('heroSubtitle').textContent = data.subtitle;

      // Sett hero-bilde (bruk CSS fallback hvis ikke satt)
      const heroSelector = `.${page}-hero`; // .home-hero / .about-hero / .services-hero
      setHeroBackground(heroSelector, data.hero_image);

      // (Valgfritt) Her kan du lese mer fra JSON (cards, sections osv.)
    } catch (err) {
      console.error('Kunne ikke laste inn side-data:', err);
    }
  }

  // --- Last inn site.json for footer (footer-tekst + orgnr) ---
  try {
    const resSite = await fetch('/data/site.json', { cache: 'no-cache' });
    if (resSite.ok) {
      const siteData  = await resSite.json();
      const footerTxt = document.getElementById('footerText');
      const orgnrEl   = document.getElementById('orgnr');

      if (footerTxt && siteData.footer) footerTxt.textContent = siteData.footer;
      if (orgnrEl   && siteData.orgnr)  orgnrEl.textContent   = siteData.orgnr;
    }
  } catch (err) {
    console.error('Kunne ikke laste inn site-data:', err);
  }
});
