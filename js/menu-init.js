// menu-init.js — with hover delay fix
(function () {
  const oldHeaderImmediate = document.querySelector('header.site-header');
  if (oldHeaderImmediate) oldHeaderImmediate.style.visibility = 'hidden';

  const ensureCss = () => {
    if (document.querySelector('link[href*="/css/menu.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/menu.css';
    document.head.appendChild(link);
  };

  const mountHeader = async () => {
    try {
      const res = await fetch('/header.html', { cache: 'no-store' });
      if (!res.ok) throw new Error('header.html fetch failed');
      const html = await res.text();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const newHeader = wrapper.firstElementChild;
      const old = document.querySelector('header.site-header');
      if (old) old.replaceWith(newHeader);
      else document.body.insertBefore(newHeader, document.body.firstChild);
      newHeader.style.visibility = 'visible';
      attachBehavior();
    } catch (e) {
      const fallback = document.querySelector('header.site-header');
      if (fallback) fallback.style.visibility = 'visible';
    }
  };

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
