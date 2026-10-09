// /js/figures.js — the two figures on the home page.
//
// 1. The timeline: which rules apply, and when, with today marked. It takes the place of the
//    picture in one section. Dates and wording come from /data/timeline.json (editable in the CMS).
//    Where "today" sits, and how long is left to the next date, is worked out from the date of the visit.
// 2. "Who has to say yes?": the visitor picks how the company enters the market and sees the gates
//    on the way, and what each one asks. The content comes from /data/gates.json (editable in the CMS).
//
// When the site is published, /scripts/prerender.mjs runs the same code and writes both figures
// into the page as plain text, so they can be read without scripts. In the browser this file then
// brings them up to date and makes them work.
//
// For testing a date: add ?today=2027-12-10 to the address.
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- Dates ---------- */

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAY = 86400000;

  // "2027-12-02" (or a full timestamp from the CMS) → days since 1970, with no time zone to trip over
  function dayNumber(value) {
    var m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY) : NaN;
  }
  function dayNumberOf(date) {
    return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
  }
  function monthYear(value) {
    var m = String(value || '').match(/^(\d{4})-(\d{2})/);
    return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : '';
  }
  function longDate(date) {
    return date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear();
  }
  // How long until a date that has not come yet
  function until(days) {
    if (days <= 1) return 'tomorrow';
    if (days <= 45) return 'in ' + days + ' days';
    var months = Math.round(days / 30.44);
    if (months < 24) return 'in ' + months + ' months';
    return 'in ' + Math.round(months / 12) + ' years';
  }

  /* ---------- 1. The timeline ---------- */

  function timelineHtml(data, now) {
    var today = dayNumberOf(now);
    var events = (data.events || [])
      .map(function (e) { return { e: e, day: dayNumber(e.date) }; })
      .filter(function (x) { return !isNaN(x.day); })
      .sort(function (a, b) { return a.day - b.day; });
    var rows = [];
    var marked = false;
    var firstAhead = true;
    var n = 0;
    function todayRow() {
      marked = true;
      rows.push('<li class="tl-today" style="--i:' + (n++) + '"><span class="tl-today-label">' + esc(data.today_label || 'Today') + ', ' + esc(longDate(now)) + '</span></li>');
    }
    events.forEach(function (x) {
      var ahead = x.day > today;
      if (ahead && !marked) todayRow();
      var state = ahead ? until(x.day - today) : (data.applies_label || 'Applies');
      rows.push('<li class="tl-event ' + (ahead ? (firstAhead ? 'is-next' : 'is-later') : 'is-past') + '" style="--i:' + (n++) + '">' +
        '<span class="tl-when">' + esc(monthYear(x.e.date)) + '</span>' +
        '<span class="tl-name">' + esc(x.e.name) + '</span>' +
        (x.e.what ? '<span class="tl-what">' + esc(x.e.what) + '</span>' : '') +
        '<span class="tl-state">' + esc(state) + '</span></li>');
      if (ahead) firstAhead = false;
    });
    if (!marked) todayRow();
    return '<figure class="story-media story-media--timeline"><div class="tl" data-timeline>' +
      (data.title ? '<p class="tl-title">' + esc(data.title) + '</p>' : '') +
      '<ol class="tl-list">' + rows.join('') + '</ol>' +
      (data.note ? '<p class="tl-note">' + esc(data.note) + '</p>' : '') +
      '</div></figure>';
  }

  // For the publish step: put the timeline in place of the picture in section n of the finished page text
  function withTimeline(sectionsHtml, n, figureHtml) {
    var parts = String(sectionsHtml).split('<section class="story-row');
    var k = Number(n) || 1;
    if (k < 1 || k >= parts.length) return sectionsHtml;
    var part = parts[k];
    if (/<figure class="story-media[\s\S]*?<\/figure>/.test(part)) {
      part = part.replace(/<figure class="story-media[\s\S]*?<\/figure>/, figureHtml);
    } else {
      part = part.replace(/^ story-row--text/, '').replace(/>/, '>' + figureHtml);
    }
    parts[k] = part;
    return parts.join('<section class="story-row');
  }

  function calm() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function mountTimeline(data, now) {
    var rows = document.querySelectorAll('#sections .story-row');
    var row = rows[(Number(data.section) || 1) - 1];
    if (!row) return;
    var holder = document.createElement('div');
    holder.innerHTML = timelineHtml(data, now);
    var figure = holder.firstChild;
    var old = row.querySelector('.story-media');
    if (old) old.replaceWith(figure);
    else { row.classList.remove('story-row--text'); row.insertBefore(figure, row.firstChild); }

    // one reveal, the first time the timeline comes into view
    var tl = figure.querySelector('.tl');
    if (calm() || !('IntersectionObserver' in window)) return;
    tl.classList.add('is-armed');
    var seen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      seen.disconnect();
      tl.classList.add('is-shown');
    }, { threshold: 0.35 });
    seen.observe(tl);
  }

  /* ---------- 2. Who has to say yes? ---------- */

  function gateText(g, label) {
    var questions = (g.questions || []).map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('');
    return (g.who ? '<p class="gates-who">' + esc(g.who) + '</p>' : '') +
      (questions ? '<ul class="gates-questions">' + questions + '</ul>' : '') +
      (g.assessment ? '<p class="gates-in"><span>' + esc(label) + '</span> ' + esc(g.assessment) + '</p>' : '');
  }

  // The whole figure as plain text: both ways in, every gate, every question
  function gatesHtml(data) {
    var paths = (data.paths || []).map(function (p) {
      var gates = (p.gates || []).map(function (g) {
        return '<li class="gates-gate"><h4>' + esc(g.name) + '</h4>' + gateText(g, data.assessment_label || 'In a Readiness Assessment') + '</li>';
      }).join('');
      return '<section class="gates-path"><h3>' + esc(p.label) + '</h3><ol class="gates-list">' + gates + '</ol></section>';
    }).join('');
    return '<h2 id="gatesTitle">' + esc(data.title || 'Who has to say yes?') + '</h2>' +
      (data.intro ? '<p class="gates-intro">' + esc(data.intro) + '</p>' : '') +
      '<div class="gates-plain">' + paths + '</div>' +
      (data.note ? '<p class="gates-note">' + esc(data.note) + '</p>' : '');
  }

  function mountGates(root, data) {
    var paths = (data.paths || []).filter(function (p) { return (p.gates || []).length; });
    if (!paths.length) { root.innerHTML = gatesHtml(data); return; }
    var path = 0;
    var gate = 0;

    root.innerHTML =
      '<h2 id="gatesTitle">' + esc(data.title || 'Who has to say yes?') + '</h2>' +
      (data.intro ? '<p class="gates-intro">' + esc(data.intro) + '</p>' : '') +
      '<div class="gates-switch" role="group" aria-label="' + esc(data.switch_label || 'How you enter the market') + '">' +
      paths.map(function (p, i) {
        return '<button type="button" class="gates-choice" data-path="' + i + '" aria-pressed="' + (i === 0) + '">' + esc(p.label) + '</button>';
      }).join('') + '</div>' +
      '<div class="gates-track"><div class="gates-rail"></div>' +
      '<p class="gates-ends" aria-hidden="true"><span>' + esc(data.from_label || 'Your product') + '</span><span>' + esc(data.to_label || 'The market') + '</span></p></div>' +
      '<div class="gates-panel" role="region" aria-live="polite" aria-labelledby="gatesPanelTitle"></div>' +
      (data.note ? '<p class="gates-note">' + esc(data.note) + '</p>' : '');
    root.classList.add('is-live');

    var rail = root.querySelector('.gates-rail');
    var panel = root.querySelector('.gates-panel');

    // The line from product to market, with a gap for each gate. The gates passed are closed; the dot waits at the one chosen.
    function drawRail() {
      var gates = paths[path].gates;
      var html = '<i class="gates-seg"></i>';
      gates.forEach(function (g, i) {
        html += '<button type="button" class="gates-gap' + (i < gate ? ' is-passed' : '') + '" data-gate="' + i + '" aria-pressed="' + (i === gate) + '">' +
          '<span class="gates-gap-name">' + esc(g.name) + '</span><i></i></button><i class="gates-seg"></i>';
      });
      rail.innerHTML = html + '<span class="gates-dot" aria-hidden="true"><b></b></span>';
      placeDot(false);
    }
    function placeDot(moving) {
      var gap = rail.querySelector('.gates-gap[data-gate="' + gate + '"]');
      var dot = rail.querySelector('.gates-dot');
      if (!gap || !dot) return;
      dot.classList.toggle('is-moving', !!moving);
      dot.style.left = (gap.offsetLeft - 2) + 'px';
    }
    function drawPanel() {
      var gates = paths[path].gates;
      var g = gates[gate];
      var next = gates[gate + 1];
      panel.innerHTML =
        '<div class="gates-panel-head"><p class="gates-count">' + esc('Gate ' + (gate + 1) + ' of ' + gates.length) + '</p>' +
        '<h3 id="gatesPanelTitle">' + esc(g.name) + '</h3>' + (g.who ? '<p class="gates-who">' + esc(g.who) + '</p>' : '') + '</div>' +
        '<div class="gates-panel-body">' +
        ((g.questions || []).length ? '<p class="gates-asks">' + esc(data.asks_label || 'What they ask') + '</p><ul class="gates-questions">' +
          g.questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>' : '') +
        (g.assessment ? '<p class="gates-in"><span>' + esc(data.assessment_label || 'In a Readiness Assessment') + '</span> ' + esc(g.assessment) + '</p>' : '') +
        '<p class="gates-actions">' +
        (next ? '<button type="button" class="btn btn--light" data-next>' + esc((data.next_label || 'Next gate') + ': ' + next.name) + '</button>'
          : (data.link_url ? '<a class="btn btn--light" href="' + esc(data.link_url) + '">' + esc(data.link_label || 'See what a Readiness Assessment covers') + '</a>' : '')) +
        '</p></div>';
    }
    function choose(p, g, moving) {
      var samePath = p === path;
      path = p;
      gate = g;
      root.querySelectorAll('.gates-choice').forEach(function (b, i) { b.setAttribute('aria-pressed', i === path); });
      if (samePath && moving) {
        rail.querySelectorAll('.gates-gap').forEach(function (b, i) {
          b.classList.toggle('is-passed', i < gate);
          b.setAttribute('aria-pressed', i === gate);
        });
        placeDot(!calm());
      } else {
        drawRail();
      }
      drawPanel();
    }

    root.addEventListener('click', function (e) {
      var c = e.target.closest('.gates-choice');
      if (c) { choose(Number(c.getAttribute('data-path')), 0, false); return; }
      var g = e.target.closest('.gates-gap');
      if (g) { choose(path, Number(g.getAttribute('data-gate')), true); return; }
      if (e.target.closest('[data-next]')) {
        choose(path, gate + 1, true);
        var first = panel.querySelector('h3');
        if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
      }
    });
    window.addEventListener('resize', function () { placeDot(false); });

    drawRail();
    drawPanel();
  }

  /* ---------- Start ---------- */

  function now() {
    var m = location.search.match(/[?&]today=(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  }

  function load(url) {
    return fetch(url + '?v=' + Date.now(), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function start() {
    if (document.body.dataset.page !== 'home') return;
    load('/data/timeline.json')
      .then(function (data) { mountTimeline(data, now()); })
      .catch(function (err) { console.error('Could not load the timeline', err); });   // the section keeps its picture
    var gates = document.querySelector('[data-gates]');
    if (gates) {
      load('/data/gates.json')
        .then(function (data) { mountGates(gates, data); })
        .catch(function (err) {
          console.error('Could not load the gates figure', err);
          if (!gates.children.length) { var band = gates.closest('[data-after-section]'); if (band) band.hidden = true; }
        });
    }
  }

  // Shared with /scripts/prerender.mjs when the site is published
  var api = { timelineHtml: timelineHtml, withTimeline: withTimeline, gatesHtml: gatesHtml, until: until };
  if (typeof window !== 'undefined') window.AttollooFigures = api;
  if (typeof document === 'undefined' || !document.body || !document.addEventListener) return;

  // The sections must be on the page first: /js/site.js says when they are
  if (window.AttollooSite && window.AttollooSite.sectionsReady) start();
  else document.addEventListener('attolloo:sections', start, { once: true });
})();
