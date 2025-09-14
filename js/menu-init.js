// menu-init.js — FOUC-free (no mobile 'Blog' flash)
(function () {
  // 0) Hide any existing header completely to avoid flash (esp. on mobile)
  const oldHeaderImmediate = document.querySelector('header.site-header');
  if (oldHeaderImmediate) oldHeaderImmediate.style.display = 'none';

  // 1) Ensure menu CSS is loaded
  const ensureCss = () => {
    if (document.querySelector('link[href*="/css/menu.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/menu.css';
    document.head.appendChild(link);
  };

  // 2) Fetch and mount new header
  const mountHeader = async () => {
    try {
      const res = await fetch('/header.html', { cache: 'no-store' });
      if (!res.ok) throw new Error('header.html fetch failed');
      const html = await res.text();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const newHeader = wrapper.firstElementChild;

      const old = document.querySelector('header.site-header');
      if (old) {
        old.replaceWith(newHeader);
      } else {
        document.body.insertBefore(newHeader, document.body.firstChild);
      }

      // Show the new header only after insertion
      newHeader.style.display = 'block';
      attachBehavior();
    } catch (e) {
      // If anything fails, re-show the old header so navigation still works
      const fallback = document.querySelector('header.site-header');
      if (fallback) fallback.style.display = 'block';
    }
  };

  // 3) Attach menu behavior (includes hover delay)
  const attachBehavior = () => {
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

    // Desktop hover with small close delay for stability
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
  };

  ensureCss();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHeader);
  } else {
    mountHeader();
  }
})();
