// /js/site.js — shared page engine for the main pages.
// Each page sets <body data-page="..."> and gets its content from /data/<file>.json.
// Content is written in Netlify CMS; this file only decides how it is shown.
//
// When the site is published, /scripts/prerender.mjs runs this same file and writes the
// finished text into each page (<body data-prerendered>), so the content is there without
// scripts. In the browser this file then only adds the behaviour. A page opened straight
// from the repository, with no publish step, is filled in here as before.
(function () {
  'use strict';

  var DATA = {
    home: '/data/home.json',
    about: '/data/about.json',
    services: '/data/services.json',
    '6sense': '/data/6sense.json',
    'ai-compass': '/data/ai-compass.json',
    polaris: '/data/polaris.json',
    kando: '/data/kando.json',
    'responsible-ai': '/data/responsible-ai.json',
    research: '/data/research.json',
    contact: '/data/contact.json',
    privacy: '/data/privacy.json',
    example: '/data/example.json',
    method: '/data/method.json'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // A short line written in capitals ("AI COMPASS", "① DIRECTION") is a sub-heading.
  function isLabel(line) {
    var t = line.trim();
    if (t.length < 3 || t.length > 100) return false;
    if (/[.!?,;]$/.test(t)) return false;
    return /[A-Z]/.test(t) && t === t.toUpperCase();
  }

  function inline(text) {
    // "CUSTOMER PROFITABILITY — Does each…" or "BOARD MEMBER: governance…" → emphasised lead-in
    var lead = String(text).match(/^([A-Z][A-Z0-9 &'\/-]{2,40})( —|:) ([\s\S]*)$/);
    if (lead) return '<span class="lead-in">' + esc(lead[1]) + '</span>' + lead[2] + ' ' + inlineRest(lead[3]);
    return inlineRest(text);
  }

  function inlineRest(text) {
    var out = esc(text);
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // [link text](/page.html) or [link text](https://…)
    out = out.replace(/\[([^\]]+)\]\((\/[^)\s]*|https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
    out = out.replace(/(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1<a href="mailto:$2">$2</a>');
    return out;
  }

  // Small, safe renderer for the text written in the CMS:
  // paragraphs, "- " lists, "1. " numbered lists, "> " quotes, "## " headings,
  // capitalised sub-headings and [text](/link) links.
  // "+++ Title" folds the rest of the section (or up to a bare "+++") behind that title.
  // "::: Title" starts a framed box with that title; a bare ":::" ends it.
  function renderText(src) {
    var lines = String(src || '').replace(/\r/g, '').split('\n');
    var html = [];
    var para = [];
    var list = [];
    var listTag = 'ul';
    var quote = [];

    function flush() {
      if (para.length) { html.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; }
      if (list.length) { html.push('<' + listTag + '>' + list.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</' + listTag + '>'); list = []; }
      if (quote.length) { html.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>'); quote = []; }
    }

    var folded = false;
    var boxed = false;
    function closeBox() { if (boxed) { html.push('</aside>'); boxed = false; } }
    function closeFold() { closeBox(); if (folded) { html.push('</div></details>'); folded = false; } }

    lines.forEach(function (raw) {
      var line = raw.trim();
      var m;
      if (!line) { flush(); return; }
      // "+++ The six dimensions in detail" puts what follows behind a "read more" line.
      // A line with only "+++" ends it; otherwise it runs to the end of the section.
      if ((m = line.match(/^\\?\+\\?\+\\?\+\s*(.*)$/))) {
        flush();
        var wasFolded = folded;
        closeFold();
        if (m[1] || !wasFolded) {
          html.push('<details class="more"><summary><span class="more-label">' + inlineRest(m[1] || 'More detail') + '</span></summary><div class="more-body">');
          folded = true;
        }
        return;
      }
      // "::: How an engagement works" frames what follows as a box, up to a line with only ":::".
      if ((m = line.match(/^\\?:\\?:\\?:\s*(.*)$/))) {
        flush();
        var wasBoxed = boxed;
        closeBox();
        if (m[1] || !wasBoxed) {
          html.push('<aside class="callout">' + (m[1] ? '<h3 class="callout-title">' + inlineRest(m[1]) + '</h3>' : ''));
          boxed = true;
        }
        return;
      }
      if ((m = line.match(/^[-*]\s+(.*)$/))) {
        if (para.length || quote.length || (list.length && listTag !== 'ul')) flush();
        listTag = 'ul';
        list.push(m[1]);
      } else if ((m = line.match(/^\d{1,2}[.)]\s+(.*)$/))) {
        if (para.length || quote.length || (list.length && listTag !== 'ol')) flush();
        listTag = 'ol';
        list.push(m[1]);
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        if (para.length || list.length) flush();
        quote.push(m[1]);
      } else if ((m = line.match(/^#{1,4}\s+(.*)$/))) {
        flush();
        html.push('<h3>' + esc(m[1]) + '</h3>');
      } else if (isLabel(line)) {
        flush();
        // "GENERATION 1 — TITLE (1980-1996)" → a timeline entry with the years set apart
        var gen = line.match(/^(GENERATION \d+ — .+?)\s*\((\d{4})\s*[-–]\s*(\d{4}|PRESENT)\)$/);
        if (gen) {
          html.push('<h3 class="gen"><span class="gen-years">' + gen[2] + '–' + (gen[3] === 'PRESENT' ? 'present' : gen[3]) +
            '</span> <span class="gen-name">' + esc(gen[1]) + '</span></h3>');
        } else {
          html.push('<h3>' + esc(line) + '</h3>');
        }
      } else {
        if (list.length || quote.length) flush();
        para.push(line);
      }
    });
    flush();
    closeFold();
    return html.join('');
  }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function sectionsHtml(sections) {
    if (!sections.length) return '<p class="empty-note wrap">No content published yet.</p>';
    var used = {};
    return '<div class="wrap">' + sections.map(function (s) {
      var heading = String(s.heading || '').trim();
      var id = slug(heading);
      if (id && used[id]) id = '';
      if (id) used[id] = true;
      var media = '';
      if (s.image && /\.svg(\?.*)?$/i.test(s.image)) {
        media = '<figure class="story-media story-media--diagram"><div class="diagram" data-svg="' + esc(s.image) + '"></div></figure>';
      } else if (s.image) {
        media = '<figure class="story-media"><img src="' + esc(s.image) + '" alt="" loading="lazy" decoding="async"></figure>';
      }
      return '<section class="story-row' + (media ? '' : ' story-row--text') + '"' + (id ? ' id="' + id + '"' : '') + '>' +
        media +
        '<div class="story-body">' +
        (heading ? '<h2>' + esc(heading) + '</h2>' : '') +
        '<div class="prose">' + renderText(s.body || s.text || '') + '</div>' +
        '</div></section>';
    }).join('') + '</div>';
  }

  // "In short": what a framework is, when it is used and what you get. Three lines between
  // the hero and the sections, for the pages that have them in their data (in_short).
  var SHORT = [['what', 'What it is'], ['when', 'When it is used'], ['get', 'What you get']];
  function summaryHtml(data) {
    var s = data && data.in_short;
    if (!s) return '';
    var items = SHORT.filter(function (k) { return String(s[k[0]] || '').trim(); }).map(function (k) {
      return '<div class="in-short-item"><dt>' + k[1] + '</dt><dd>' + inlineRest(String(s[k[0]]).trim()) + '</dd></div>';
    }).join('');
    return items ? '<aside class="in-short" aria-label="In short"><dl class="in-short-list">' + items + '</dl></aside>' : '';
  }

  // Everything that goes between the hero and the footer
  function pageHtml(data) {
    return summaryHtml(data) + sectionsHtml(sectionsOf(data));
  }

  function sectionsOf(data) {
    return Array.isArray(data.sections) ? data.sections
      : (Array.isArray(data.services) ? data.services : []);
  }

  // A full-width band (the pitch film, the gates figure) can ask to sit after section n:
  // <section data-after-section="3">. With fewer sections it stays where the page has it.
  // Several bands can ask; the sections are regrouped around them in order.
  function placeBands(container) {
    var bands = Array.prototype.slice.call(document.querySelectorAll('[data-after-section]'));
    if (!bands.length) return;
    var wraps = Array.prototype.slice.call(container.querySelectorAll('.wrap'));
    var rows = [];
    wraps.forEach(function (w) { Array.prototype.push.apply(rows, Array.prototype.slice.call(w.children)); });
    function at(band) { return parseInt(band.getAttribute('data-after-section'), 10) || 0; }
    var among = bands.filter(function (b) { return at(b) > 0 && at(b) < rows.length; })
      .sort(function (a, b) { return at(a) - at(b); });
    if (among.length) {
      var parts = document.createDocumentFragment();
      var from = 0;
      var group = function (to) {
        if (to <= from) return;
        var w = document.createElement('div');
        w.className = 'wrap';
        rows.slice(from, to).forEach(function (row) { w.appendChild(row); });
        parts.appendChild(w);
        from = to;
      };
      among.forEach(function (band) { group(at(band)); parts.appendChild(band); });
      group(rows.length);
      wraps.forEach(function (w) { w.remove(); });
      container.appendChild(parts);
    }
    bands.forEach(function (band) { band.classList.add('is-placed'); });
  }

  // Fetch each diagram and place it in the page. Scripts and event attributes are removed first.
  function loadDiagrams(container) {
    container.querySelectorAll('.diagram[data-svg]').forEach(function (slot) {
      var src = slot.getAttribute('data-svg');
      fetch(src)
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
        .then(function (text) {
          var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
          var svg = doc.documentElement;
          if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('not an svg');
          svg.querySelectorAll('script, foreignObject').forEach(function (n) { n.remove(); });
          svg.querySelectorAll('*').forEach(function (n) {
            Array.prototype.slice.call(n.attributes).forEach(function (a) {
              if (/^on/i.test(a.name) || (/href$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
            });
          });
          slot.appendChild(document.importNode(svg, true));
        })
        .catch(function (err) {
          console.error('Could not load diagram ' + src, err);
          slot.innerHTML = '<img src="' + esc(src) + '" alt="">';
        });
    });
  }

  // A link to "#section" opens the detail in that section; printing opens everything.
  function openFoldsFor(hash) {
    var id = String(hash || '').replace(/^#/, '');
    if (!id) return;
    var target = null;
    try { target = document.getElementById(decodeURIComponent(id)); } catch (e) { return; }
    if (!target) return;
    target.querySelectorAll('details.more').forEach(function (d) { d.open = true; });
    target.scrollIntoView();
  }
  function wireFolds() {
    openFoldsFor(location.hash);
    window.addEventListener('hashchange', function () { openFoldsFor(location.hash); });
    window.addEventListener('beforeprint', function () {
      document.querySelectorAll('details.more').forEach(function (d) { d.open = true; });
    });
  }

  // Six-sided figure used for the 6Sense self-test.
  function hexFigure() {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = (Math.PI / 180) * (60 * i - 90);
      pts.push([50 + 44 * Math.cos(a), 50 + 44 * Math.sin(a)]);
    }
    var fills = ['#30b454', '#30b454', '#e9b44c', '#30b454', '#ffffff', '#e9b44c'];
    var wedges = pts.map(function (p, i) {
      var q = pts[(i + 1) % 6];
      return '<polygon points="50,50 ' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ' ' + q[0].toFixed(1) + ',' + q[1].toFixed(1) +
        '" fill="' + fills[i] + '" stroke="#002448" stroke-width="1.5" stroke-linejoin="round"/>';
    }).join('');
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + wedges + '</svg>';
  }

  // The self-test invitation is for founders; skip it on the self-test itself, the research page and the privacy page
  function wantsMatchBand(page) {
    return page !== 'match' && page !== 'research' && page !== 'privacy';
  }

  function matchBandHtml() {
    return '<aside class="match-band" aria-labelledby="matchBandTitle">' +
      '<div class="wrap match-band-inner">' + hexFigure() +
      '<div><h2 id="matchBandTitle">Is Attolloo right for your company?</h2>' +
      '<p>A short self-test, about two minutes. You get a straight answer, including when the answer is no.</p></div>' +
      '<a class="btn btn--primary" href="/match.html">Take the self-test</a>' +
      '</div></aside>';
  }

  function addMatchBand(before) {
    if (document.querySelector('.match-band')) return;   // already in the published page
    before.insertAdjacentHTML('beforebegin', matchBandHtml());
  }

  function loadFooter() {
    var slot = document.getElementById('footer');
    if (!slot) return Promise.resolve();
    if (slot.children.length) {                           // already in the published page
      var y = document.getElementById('year');
      if (y) y.textContent = new Date().getFullYear();
      return Promise.resolve();
    }
    return fetch('/footer.html', { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        slot.innerHTML = html;
        var year = document.getElementById('year');
        if (year) year.textContent = new Date().getFullYear();
      })
      .catch(function (err) { console.error('Could not load footer:', err); });
  }

  // Behaviour for the sections once their text is in the page
  function wireSections(container) {
    placeBands(container);
    loadDiagrams(container);
    wireFolds();
    // other scripts (the figures on the home page) wait for the sections to be in the page
    window.AttollooSite.sectionsReady = true;
    document.dispatchEvent(new CustomEvent('attolloo:sections'));
    // Jump to a section if the address has an #anchor
    if (location.hash.length > 1) {
      var target = null;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { /* odd address */ }
      if (target) target.scrollIntoView();
    }
  }

  function loadPage() {
    var page = document.body.dataset.page;
    var url = DATA[page];
    var footerSlot = document.getElementById('footer');
    if (footerSlot && wantsMatchBand(page)) addMatchBand(footerSlot);
    if (!url) return;
    var container = document.getElementById('sections');

    // Published pages already hold their text
    if (document.body.hasAttribute('data-prerendered')) {
      if (container) wireSections(container);
      return;
    }

    fetch(url + '?v=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var title = document.getElementById('heroTitle');
        var sub = document.getElementById('heroSubtitle');
        if (title) title.textContent = String(data.title || '').trim();
        if (sub) sub.textContent = String(data.subtitle || '').trim();

        var hero = document.getElementById('hero');
        var img = heroImage(data);
        if (hero && img) hero.style.setProperty('--hero-img', heroImageCss(img));

        if (container) { container.innerHTML = pageHtml(data); wireSections(container); }
      })
      .catch(function (err) {
        console.error('Could not load ' + url, err);
        if (container) container.innerHTML = '<p class="empty-note wrap">This page could not be loaded. Please try again in a moment.</p>';
      });
  }

  function heroImage(data) { return String(data.hero_image || data.image || ''); }
  function heroImageCss(img) { return 'url("' + String(img).replace(/"/g, '%22') + '")'; }

  // Shared with /js/match.js, and with /scripts/prerender.mjs when the site is published
  window.AttollooSite = {
    esc: esc,
    renderText: renderText,
    DATA: DATA,
    sectionsHtml: sectionsHtml,
    sectionsOf: sectionsOf,
    pageHtml: pageHtml,
    heroImage: heroImage,
    heroImageCss: heroImageCss,
    wantsMatchBand: wantsMatchBand,
    matchBandHtml: matchBandHtml
  };

  // A picture that fails to download (a weak mobile connection) is tried again, twice,
  // instead of being left as a broken frame. If it still fails, the frame is left empty.
  function retryPictures() {
    if (typeof document.addEventListener !== 'function') return;   // the publish step has no page to listen to
    function again(img) {
      var n = Number(img.getAttribute('data-retry') || 0);
      var src = String(img.getAttribute('src') || '').replace(/[?&]retry=\d+$/, '');
      if (!src) return;
      if (n >= 2) { img.style.visibility = 'hidden'; return; }
      img.setAttribute('data-retry', n + 1);
      setTimeout(function () {
        img.src = src + (src.indexOf('?') < 0 ? '?' : '&') + 'retry=' + (n + 1);
      }, n ? 5000 : 1500);
    }
    document.addEventListener('error', function (e) {
      var t = e.target;
      if (t && t.tagName === 'IMG' && t.closest && t.closest('.story-media, .contact-card')) again(t);
    }, true);
    // pictures that had already failed before this script ran
    document.querySelectorAll('.story-media img, .contact-card img').forEach(function (img) {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) again(img);
    });
  }

  function start() {
    retryPictures();
    loadPage();
    loadFooter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
