function setHeroBackground(selector, imageUrl) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (imageUrl && imageUrl.trim() !== "") {
    el.style.backgroundImage = `url("${imageUrl}")`;
  }
  // Hvis ingen imageUrl -> CSS fallback brukes
}
(async function () {
  // Les hvilket "page key" vi skal hente, satt på <body data-page="home|about|services">
  const page = document.body.dataset.page || "home";

  // Hent felles site-data
  const site = await fetch("/data/site.json").then(r => r.json()).catch(() => ({}));

  // Hent side-spesifikk data
  const data = await fetch(`/data/${page}.json`).then(r => r.json());

  // Hero
  const heroTitle = document.getElementById("heroTitle");
  const heroSubtitle = document.getElementById("heroSubtitle");
  const heroImg = document.getElementById("heroImage");

  if (heroTitle && data.title) heroTitle.textContent = data.title;
  if (heroSubtitle && data.subtitle) heroSubtitle.textContent = data.subtitle;
  if (heroImg && data.hero_image) heroImg.setAttribute("src", data.hero_image);

  // Footer orgnr + tekst
  const yearSpan = document.getElementById("year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  const orgnrSpan = document.getElementById("orgnr");
  if (orgnrSpan && site.orgnr) orgnrSpan.textContent = site.orgnr;

  const footerText = document.getElementById("footerText");
  if (footerText && site.footer) footerText.textContent = site.footer;

  // Side-spesifikk rendering
  if (page === "home" && Array.isArray(data.cards)) {
    const cardsEl = document.getElementById("cards");
    if (cardsEl) {
      cardsEl.innerHTML = data.cards.map(c => `
        <div class="card">
          <h3>${c.heading}</h3>
          <p>${c.body ?? ""}</p>
        </div>
      `).join("");
    }
  }

  if (page === "about" && Array.isArray(data.sections)) {
    const secEl = document.getElementById("sections");
    if (secEl) {
      secEl.innerHTML = data.sections.map(s => `
        <section class="section">
          <h2>${s.heading}</h2>
          <div class="markdown">${s.body ?? ""}</div>
        </section>
      `).join("");
    }
  }

  if (page === "services" && Array.isArray(data.items)) {
    const listEl = document.getElementById("serviceList");
    if (listEl) {
      listEl.innerHTML = data.items.map(it => `
        <section class="service">
          <h2>${it.heading}</h2>
          <div class="markdown">${it.body ?? ""}</div>
        </section>
      `).join("");
    }
  }
})();
