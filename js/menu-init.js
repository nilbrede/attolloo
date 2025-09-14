// menu-init.js — FOUC-proof + hover delay + stray 'Blog' guard
(function () {
  // 0) Guard: remove any stray top-level blog links that might have been left in HTML
  document.querySelectorAll('body > a[href*="blog"], body > ul > li > a[href*="blog"]').forEach(el => {
    el.parentElement && el.parentElement.tagName === 'LI' && el.parentElement.parentElement === document.body
      ? el.parentElement.remove()
      : el.remove();
  });

  // 1) Hide any existing header immediately to avoid flash
  const oldHeader = document.querySelector('header.site-header');
  if (oldHeader) oldHeader.style.display = 'none';

  // 2) Ensure menu CSS is loaded and wait for it before showing the new header
  function loadMenuCss() {
    return new Promise((resolve) => {
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

  async function mountHeader() {
    try {
      const res = await fetch('/header.html', { cache: 'no-store' });
      if (!res.ok) throw new Error('header.html fetch failed');
      const html = await res.text();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const newHeader = wrapper.firstElementChild;
      newHeader.style.display = 'none'; // keep hidden until CSS ready

      const old = document.querySelector('header.site-header');
      if (old) old.replaceWith(newHeader); else document.body.insertBefore(newHeader, document.body.firstChild);

      await loadMenuCss();
      newHeader.style.display = 'block';
      attachBehavior();
    } catch (e) {
      const fallback = document.querySelector('header.site-header');
      if (fallback) fallback.style.display = 'block';
    }
  }

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
        if (e.key === 'ArrowDown') { e.preventDefault(); openMega(btn); firstLink(btn)?.focus(); }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeAllMega(); burger.setAttribute('aria-expanded', false); nav.classList.remove('open'); }
    });
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !burger.contains(e.target)) closeAllMega();
    });

    // Desktop hover with small close delay
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
