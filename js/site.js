// /js/site.js — shared page engine for the main pages.
// Each page sets <body data-page="..."> and gets its content from /data/<file>.json.
// Content is written in Netlify CMS; this file only decides how it is shown.
(function () {
  'use strict';

  var DATA = {
    home: '/data/home.json',
    about: '/data/about.json',
    services: '/data/services.json',
    startups: '/data/startups.json',
    'ai-compass': '/data/ai-compass.json',
    polaris: '/data/polaris.json',
    lumina: '/data/lumina.json',
    'responsible-ai': '/data/responsible-ai.json',
    research: '/data/research.json'
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
    // "BOARD MEMBER — Strategic direction…" → emphasised lead-in
    var lead = String(text).match(/^([A-Z][A-Z0-9 &'\/-]{2,40}) — ([\s\S]*)$/);
    if (lead) return '<span class="lead-in">' + esc(lead[1]) + '</span> — ' + inlineRest(lead[2]);
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

    lines.forEach(function (raw) {
      var line = raw.trim();
      var m;
      if (!line) { flush(); return; }
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
        html.push('<h3>' + esc(line) + '</h3>');
      } else {
        if (list.length || quote.length) flush();
        para.push(line);
      }
    });
    flush();
    return html.join('');
  }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function renderSections(container, sections) {
    if (!sections.length) {
      container.innerHTML = '<p class="empty-note wrap">No content published yet.</p>';
      return;
    }
    var used = {};
    container.innerHTML = '<div class="wrap">' + sections.map(function (s) {
      var heading = String(s.heading || '').trim();
      var id = slug(heading);
      if (id && used[id]) id = '';
      if (id) used[id] = true;
      var media = s.image
        ? '<figure class="story-media"><img src="' + esc(s.image) + '" alt="" loading="lazy" decoding="async"></figure>'
        : '';
      return '<section class="story-row' + (media ? '' : ' story-row--text') + '"' + (id ? ' id="' + id + '"' : '') + '>' +
        media +
        '<div class="story-body">' +
        (heading ? '<h2>' + esc(heading) + '</h2>' : '') +
        '<div class="prose">' + renderText(s.body || s.text || '') + '</div>' +
        '</div></section>';
    }).join('') + '</div>';
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

  function addMatchBand(before) {
    var band = document.createElement('aside');
    band.className = 'match-band';
    band.setAttribute('aria-labelledby', 'matchBandTitle');
    band.innerHTML =
      '<div class="wrap match-band-inner">' + hexFigure() +
      '<div><h2 id="matchBandTitle">Is Attolloo right for your company?</h2>' +
      '<p>A short self-test, about two minutes. You get a straight answer, including when the answer is no.</p></div>' +
      '<a class="btn btn--primary" href="/match.html">Take the self-test</a>' +
      '</div>';
    before.parentNode.insertBefore(band, before);
  }

  function loadFooter() {
    var slot = document.getElementById('footer');
    if (!slot) return Promise.resolve();
    return fetch('/footer.html', { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        slot.innerHTML = html;
        var year = document.getElementById('year');
        if (year) year.textContent = new Date().getFullYear();
      })
      .catch(function (err) { console.error('Could not load footer:', err); });
  }

  function loadPage() {
    var page = document.body.dataset.page;
    var url = DATA[page];
    var footerSlot = document.getElementById('footer');
    // The self-test invitation is for founders; skip it on the self-test itself and on the research page
    if (footerSlot && page !== 'match' && page !== 'research') addMatchBand(footerSlot);
    if (!url) return;

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
        var img = data.hero_image || data.image || '';
        if (hero && img) hero.style.setProperty('--hero-img', 'url("' + String(img).replace(/"/g, '%22') + '")');

        var sections = Array.isArray(data.sections) ? data.sections
          : (Array.isArray(data.services) ? data.services : []);
        var container = document.getElementById('sections');
        if (container) renderSections(container, sections);

        // Jump to a section if the address has an #anchor
        if (location.hash.length > 1) {
          var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
          if (target) target.scrollIntoView();
        }
      })
      .catch(function (err) {
        console.error('Could not load ' + url, err);
        var container = document.getElementById('sections');
        if (container) container.innerHTML = '<p class="empty-note wrap">This page could not be loaded. Please try again in a moment.</p>';
      });
  }

  // Shared with /js/match.js
  window.AttollooSite = { esc: esc, renderText: renderText };

  function start() {
    loadPage();
    loadFooter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
