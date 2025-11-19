// menu-init.js — New clean version with correct anchors, stable init, no legacy items
(function () {

  // 0) Remove stray blog links (as before)
  document.querySelectorAll(
    'body > a[href*="blog"], body > a[href*="blogg"], body > ul > li > a[href*="blog"], body > ul > li > a[href*="blogg"]'
  ).forEach(el => {
    const li = el.closest('li');
    if (li && li.parentElement === document.body) {
      li.remove();
    } else if (el.parentElement === document.body) {
      el.remove();
    } else {
      el.style.display = 'none';
    }
  });

  // 1) Hide any existing header immediately
  const oldHeader = document.querySelector('header.site-header');
  if (oldHeader) oldHeader.style.display = 'none';

  // 2) Ensure menu.css is loaded
  function ensureMenuCss() {
    return new Promise(resolve => {
      const existing = document.querySelector('link[href="/css/menu.css"], link[href*="/css/menu.css"]');
      if (existing) {
        if (existing.sheet) return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/menu.css';
      link.addEventListener('load', () => resolve(), { once: true });
      document.head.appendChild(link);
    });
  }

  // 3) Build new header (clean, updated)
  function buildHeader() {
    const html = `
<header class="site-header">
  <div class="container">

    <a class="site-logo" href="/index.html" aria-label="Til forsiden">
      <img src="/aab-logo.png" alt="Attolloo logo" />
    </a>
    <span class="site-brand-text">Attolloo Group</span>

    <button class="nav-toggle" aria-expanded="false" aria-controls="primary-nav">
      <span class="sr-only">Meny</span> ☰
    </button>

    <nav id="primary-nav" class="nav main-nav" aria-label="Hovedmeny">
      <ul class="nav-root">

        <!-- Tjenester -->
        <li class="has-mega">
          <button class="nav-parent" aria-expanded="false">Tjenester</button>
          <div class="mega" role="region" aria-label="Tjenester undermeny">
            <div class="mega-col">
              <h4>Tjenester</h4>
              <a href="/services.html">Oversikt</a>
              <a href="/services.html#leadership">Leadership &amp; Culture</a>
              <a href="/services.html#growth">Growth &amp; Innovation</a>
              <a href="/services.html#structure">Structure &amp; Scale</a>
            </div>
          </div>
        </li>

        <!-- Arenaer: Polaris & Lumina -->
        <li class="has-mega">
          <button class="nav-parent" aria-expanded="false">Arenaer – Polaris &amp; Lumina</button>
          <div class="mega" role="region" aria-label="Arenaer undermeny">
            <div class="mega-col">
              <a href="/services.html#polaris">Polaris</a>
              <a href="/services.html#lumina">Lumina</a>
            </div>
          </div>
        </li>

        <!-- Om oss og Blogg -->
        <li><a href="/about.html">Om oss</a></li>
        <li><a href="/blog/">Blogg</a></li>

      </ul>
    </nav>

  </div>
</header>`;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
  }

  // 4) Mount when CSS is ready
  async function mountHeader() {
    try {
      await ensureMenuCss();
      const newHeader = buildHeader();
      const old = document.querySelector('header.site-header');
      if (old) old.replaceWith(newHeader);
      else document.body.insertBefore(newHeader, document.body.firstChild);
      attachBehavior();
    } catch (e) {
      const fallback = document.querySelector('header.site-header');
      if (fallback) fallback.style.display = 'block';
    }
  }

  // 5) Menu interaction logic
  function attachBehavior() {
    const nav = document.getElementById('primary-nav');
    const burger = document.querySelector('.nav-toggle');
    const parents = document.querySelectorAll('.has-mega > .nav-parent');

    if (!nav || !burger) return;

    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
      if (!open) closeAllMega();
    });

    parents.forEach(btn => {
      btn.addEventListener('click', () => toggleMega(btn));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          openMega(btn);
          firstLink(btn)?.focus();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllMega();
        burger.setAttribute('aria-expanded', false);
        nav.classList.remove('open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !burger.contains(e.target)) {
        closeAllMega();
      }
    });

    // Desktop hover behaviour
    const mql = window.matchMedia('(hover:hover) and (pointer:fine)');
    if (mql.matches) {
      let closeTimer;
      parents.forEach(btn => {
        const li = btn.parentElement;
        li.addEventListener('mouseenter', () => {
          clearTimeout(closeTimer);
          openMega(btn);
        });
        li.addEventListener('mouseleave', () => {
          clearTimeout(closeTimer);
          closeTimer = setTimeout(closeAllMega, 200);
        });
      });
    }

    function openMega(btn) {
      closeAllMega();
      const li = btn.parentElement;
      li.classList.add('open');
      btn.setAttribute('aria-expanded', true);
    }
    function closeAllMega() {
      document.querySelectorAll('.has-mega.open').forEach(li => {
        li.classList.remove('open');
        const b = li.querySelector('.nav-parent');
        if (b) b.setAttribute('aria-expanded', false);
      });
    }
    function toggleMega(btn) {
      const isOpen = btn.parentElement.classList.contains('open');
      isOpen ? closeAllMega() : openMega(btn);
    }
    function firstLink(btn) {
      return btn.parentElement.querySelector('.mega a, .mega button');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHeader);
  } else {
    mountHeader();
  }

})();
