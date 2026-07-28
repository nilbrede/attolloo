// menu-init.js — Updated clean English menu for Attolloo Group
(function () {

  // 0) Remove stray legacy blog links if present
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

  // 3) Build new header (clean, English, high-impact)
  function buildHeader() {
    const html = `
<header class="site-header">
  <div class="container">

    <a class="site-logo" href="/index.html" aria-label="Home">
      <img src="/aab-logo.png" alt="Attolloo logo" />
    </a>
    <span class="site-brand-text">Attolloo Group</span>

    <button class="nav-toggle" aria-expanded="false" aria-controls="primary-nav">
      <span class="sr-only">Menu</span> ☰
    </button>

    <nav id="primary-nav" class="nav main-nav" aria-label="Main menu">
      <ul class="nav-root">

        <!-- Attolloo Lab Mega Menu -->
        <li class="has-mega">
          <button class="nav-parent" aria-expanded="false">Attolloo Lab</button>
          <div class="mega" role="region" aria-label="Attolloo Lab submenu">
            <div class="mega-col">
              <h4>Venture Studio &amp; Stack</h4>
              <a href="/lab.html">Overview &amp; Method</a>
              <a href="/startups.html">6Sense Filter™</a>
              <a href="/ai-compass.html">AI Compass™</a>
              <a href="/polaris.html">Polaris Sprints™</a>
            </div>
          </div>
        </li>

        <!-- EaaS Model -->
        <li><a href="/services.html">EaaS Model</a></li>

        <!-- About -->
        <li><a href="/about.html">About</a></li>

        <!-- Contact -->
        <li><a href="/contact.html">Contact</a></li>

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