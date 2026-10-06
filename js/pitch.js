// /js/pitch.js — the one-minute pitch, as an animation built from text.
// Scenes and wording come from /data/pitch.json (editable in the CMS).
// No sound, no autoplay: it only runs when the visitor presses play,
// or follows a link marked data-pitch-play ("Watch the one-minute pitch").
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function clock(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  // "6Sense Filter: who qualifies" → name in bold, explanation after it
  function itemHtml(text) {
    var m = String(text).match(/^([^:]{2,40}):\s+(.+)$/);
    if (m) return '<span class="pitch-item-name">' + esc(m[1]) + '</span> <span class="pitch-item-note">' + esc(m[2]) + '</span>';
    return '<span class="pitch-item-name">' + esc(text) + '</span>';
  }

  function build(root, data) {
    var scenes = data.scenes || [];
    var starts = [];
    var total = 0;
    scenes.forEach(function (s) { starts.push(total); total += (Number(s.seconds) || 6) * 1000; });

    var line = data.line || {};

    // ----- scenes -----
    var scenesHtml = scenes.map(function (s, i) {
      var seconds = Number(s.seconds) || 6;
      var words = String(s.headline || '').split(/\s+/).filter(Boolean);
      var step = 0.07;
      var headline = words.map(function (w, k) {
        return '<span class="pitch-anim" style="--d:' + (0.15 + k * step).toFixed(2) + 's">' + esc(w) + '</span>';
      }).join(' ');
      var t = 0.15 + words.length * step + 0.5;            // when the headline has landed
      var items = Array.isArray(s.items) ? s.items : [];
      var hold = 1.6;                                         // seconds everything stays before the scene ends
      var room = Math.max(0.3, seconds - hold - t - (s.detail ? 0.8 : 0));
      var itemStep = items.length ? Math.min(0.85, room / items.length) : 0;
      var itemsHtml = items.map(function (it, k) {
        return '<li class="pitch-anim" style="--d:' + (t + k * itemStep).toFixed(2) + 's">' + itemHtml(it) + '</li>';
      }).join('');
      var after = t + items.length * itemStep + (items.length ? 0.2 : 0.3);
      var detail = s.detail
        ? '<p class="pitch-detail pitch-anim" style="--d:' + after.toFixed(2) + 's">' + esc(s.detail) + '</p>' : '';
      var cta = s.type === 'close' && data.cta_url
        ? '<p class="pitch-cta pitch-anim" style="--d:' + (after + 0.7).toFixed(2) + 's"><a class="btn btn--light" href="' + esc(data.cta_url) + '">' + esc(data.cta_label || 'Are we a match?') + '</a></p>' : '';
      return '<div class="pitch-scene pitch-scene--' + esc(s.type || 'statement') + '" data-items="' + items.length + '" aria-hidden="true">' +
        '<p class="pitch-headline">' + headline + '</p>' +
        (items.length ? '<ul class="pitch-items">' + itemsHtml + '</ul>' : '') + detail + cta + '</div>';
    }).join('');

    // ----- the line with a gap in it -----
    var lineHtml =
      '<div class="pitch-line" aria-hidden="true">' +
      '<span class="pitch-seg pitch-seg--left"><i></i><b>' + esc(line.left || '') + '</b></span>' +
      '<span class="pitch-seg pitch-seg--gap"><i></i><b class="pitch-gap-label">' + esc(line.gap || '') + '</b><b class="pitch-bridge-label">' + esc(line.bridge || '') + '</b></span>' +
      '<span class="pitch-seg pitch-seg--right"><i></i><b>' + esc(line.right || '') + '</b></span>' +
      '</div>';

    var segs = scenes.map(function (s, i) {
      return '<button type="button" class="pitch-step" data-seek="' + i + '" style="flex-grow:' + (Number(s.seconds) || 6) + '" aria-label="Go to part ' + (i + 1) + ' of ' + scenes.length + '"><span></span></button>';
    }).join('');

    var transcript = scenes.map(function (s) {
      var items = (s.items || []).length ? ' ' + s.items.map(esc).join('. ') + '.' : '';
      return '<li>' + esc(s.headline) + items + (s.detail ? ' ' + esc(s.detail) : '') + '</li>';
    }).join('');

    root.innerHTML =
      '<div class="pitch-stage" role="group" aria-label="One-minute pitch. Animation without sound." data-line="none">' +
      lineHtml + scenesHtml +
      '<div class="pitch-poster">' +
      '<p class="pitch-headline">' + esc(data.poster_title || 'The pitch in one minute') + '</p>' +
      '<button type="button" class="pitch-start btn btn--light" data-act="toggle"><span class="pitch-icon" aria-hidden="true"></span>' + esc(data.play_label || 'Play') + '</button>' +
      '</div>' +
      '</div>' +
      '<div class="pitch-controls">' +
      '<button type="button" class="pitch-toggle" data-act="toggle" aria-label="Play"><span class="pitch-icon" aria-hidden="true"></span></button>' +
      '<div class="pitch-steps">' + segs + '</div>' +
      '<span class="pitch-time" aria-hidden="true">0:00 / ' + clock(total) + '</span>' +
      '</div>' +
      '<details class="pitch-transcript"><summary>' + esc(data.transcript_label || 'Read the pitch as text') + '</summary><ol>' + transcript + '</ol></details>';

    var stage = root.querySelector('.pitch-stage');
    var sceneEls = root.querySelectorAll('.pitch-scene');
    var stepEls = root.querySelectorAll('.pitch-step');
    var toggle = root.querySelector('.pitch-toggle');
    var timeEl = root.querySelector('.pitch-time');

    var t = 0, playing = false, current = -1, last = 0, raf = 0;

    function show(i, restart) {
      if (i === current && !restart) return;
      current = i;
      sceneEls.forEach(function (el, k) {
        var on = k === i;
        el.classList.remove('is-active');
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) { void el.offsetWidth; el.classList.add('is-active'); }   // restart its animations
      });
      stage.setAttribute('data-line', scenes[i].line || 'none');
    }

    function paint() {
      var i = 0;
      for (var k = 0; k < starts.length; k++) if (t >= starts[k]) i = k;
      show(i, false);
      stepEls.forEach(function (el, k) {
        var len = (Number(scenes[k].seconds) || 6) * 1000;
        var p = Math.max(0, Math.min(1, (t - starts[k]) / len));
        el.firstChild.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      });
      timeEl.textContent = clock(t) + ' / ' + clock(total);
    }

    function setPlaying(on) {
      playing = on;
      stage.classList.toggle('is-playing', on);
      stage.classList.toggle('is-paused', !on && stage.classList.contains('is-started') && t < total);
      toggle.setAttribute('aria-label', on ? 'Pause' : (t >= total ? (data.replay_label || 'Play again') : 'Play'));
      toggle.classList.toggle('is-on', on);
      cancelAnimationFrame(raf);
      if (on) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }

    function tick(now) {
      if (!playing) return;
      t += Math.min(100, now - last);
      last = now;
      if (t >= total) {
        t = total;
        paint();
        stage.classList.add('is-ended');
        setPlaying(false);
        return;
      }
      paint();
      raf = requestAnimationFrame(tick);
    }

    function start(from) {
      stage.classList.add('is-started');
      stage.classList.remove('is-ended');
      t = from;
      current = -1;
      paint();
      setPlaying(true);
    }

    root.addEventListener('click', function (e) {
      var seek = e.target.closest('[data-seek]');
      if (seek) { start(starts[Number(seek.getAttribute('data-seek'))]); return; }
      if (!e.target.closest('[data-act="toggle"]')) return;
      if (!stage.classList.contains('is-started') || t >= total) start(0);
      else setPlaying(!playing);
    });

    // Pause when the film is out of view or the tab is hidden
    document.addEventListener('visibilitychange', function () { if (document.hidden && playing) setPlaying(false); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (playing && entries[0].intersectionRatio < 0.25) setPlaying(false);
      }, { threshold: [0, 0.25, 1] }).observe(stage);
    }

    // "Watch the one-minute pitch" elsewhere on the page: scroll to the film, then start it
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[data-pitch-play]');
      if (!link || !document.body.contains(stage)) return;
      e.preventDefault();
      var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      stage.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
      toggle.focus({ preventScroll: true });
      if (playing) return;
      if (!('IntersectionObserver' in window)) { start(0); return; }
      var arrive = new IntersectionObserver(function (entries) {
        if (entries[0].intersectionRatio < 0.6) return;
        arrive.disconnect();
        if (!playing) start(0);
      }, { threshold: [0.6] });
      arrive.observe(stage);
    });

    // Poster: a title, the play button and the line with its gap, until play is pressed
    stage.setAttribute('data-line', 'gap');
    timeEl.textContent = clock(0) + ' / ' + clock(total);

    // For recording and testing: /pitch.html?autoplay (add &record to fill the window with the film)
    if (/[?&]record\b/.test(location.search)) document.documentElement.classList.add('pitch-record');
    if (/[?&]autoplay\b/.test(location.search)) start(0);
  }

  function init() {
    var roots = document.querySelectorAll('[data-pitch]');
    if (!roots.length) return;
    fetch('/data/pitch.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) { roots.forEach(function (r) { build(r, data); }); })
      .catch(function (err) {
        console.error('Could not load the pitch', err);
        roots.forEach(function (r) { r.hidden = true; });
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
