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

// Last inn riktig JSON basert på data-page på <body>
document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.page;           // "home", "about" eller "services"
  const urlMap = {
    home:     '/data/home.json',
    about:    '/data/about.json',
    services: '/data/services.json'
  };

  const jsonUrl = urlMap[page];
  if (!jsonUrl) return; // ingen side å laste

  try {
    const res = await fetch(jsonUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Sett hero-tekst
    if (data.title)    document.getElementById('heroTitle').textContent    = data.title;
    if (data.subtitle) document.getElementById('heroSubtitle').textContent = data.subtitle;

    // Sett hero-bilde
    const heroSelector = `.${page}-hero`; // .home-hero / .about-hero / .services-hero
    setHeroBackground(heroSelector, data.hero_image);

    // (Valgfritt) her kan du fylle inn øvrig innhold fra JSON hvis du vil
    // f.eks. sections, cards osv. – men for hero holder dette.
  } catch (err) {
    console.error('Kunne ikke laste inn side-data:', err);
  }
});
