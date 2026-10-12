// /js/pitch.js — the one-minute pitch, as a short film built from text, photographs and line drawings.
// The line at the bottom carries the story: a dot runs up to a gap, is stopped there, and crosses when the gap closes.
// When the gap opens, the picture itself breaks in two above it, and the ones who have to say yes stand
// in the opening as posts. When the gap is bridged they give way one by one, and the picture closes.
// The photographs cut behind a sweep across the frame; the line and the dot stay in view while they do.
// Scenes, wording and backdrops come from /data/pitch.json (editable in the CMS).
// It opens cold: the frame comes out of the dark behind a flare of light, with a hit on the soundtrack.
// Light drifts through the frame the whole time (a canvas over the photographs), bursts when the picture
// breaks and when it closes, and pulses with the beat. A word marked *like this* in a headline is lit.
// Sound comes from /js/pitch-sound.js, made in the browser; it can be switched off, and the choice is kept.
// No autoplay: it only runs when the visitor presses play,
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

  function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function clamp01(p) { return Math.max(0, Math.min(1, p)); }

  // a word marked *like this* in a headline is lit; the marks are never shown
  function plain(s) { return String(s == null ? '' : s).replace(/\*/g, ''); }

  // "6Sense Filter: who qualifies" → name in bold, explanation after it
  function itemHtml(text) {
    var m = String(text).match(/^([^:]{2,40}):\s+(.+)$/);
    if (m) return '<span class="pitch-item-name">' + esc(m[1]) + '</span> <span class="pitch-item-note">' + esc(m[2]) + '</span>';
    return '<span class="pitch-item-name">' + esc(text) + '</span>';
  }

  // Line drawings for the four frameworks, in the order they are listed:
  // the six-sided filter, the five-step scale, the sprint track with its milestones, the cycle.
  var GLYPHS = [
    '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      '<path class="pitch-tint" d="M24 24V5L7.5 14.5Z"/>' +
      '<path class="pitch-draw" pathLength="1" d="M24 5L40.5 14.5V33.5L24 43L7.5 33.5V14.5Z"/>' +
      '<path class="pitch-draw pitch-draw--late" pathLength="1" d="M24 5V43M7.5 14.5L40.5 33.5M40.5 14.5L7.5 33.5"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      '<rect class="pitch-rise" style="--k:0" x="5" y="34" width="5.5" height="8"/>' +
      '<rect class="pitch-rise" style="--k:1" x="13.2" y="28" width="5.5" height="14"/>' +
      '<rect class="pitch-rise" style="--k:2" x="21.4" y="21" width="5.5" height="21"/>' +
      '<rect class="pitch-rise" style="--k:3" x="29.6" y="14" width="5.5" height="28"/>' +
      '<rect class="pitch-rise" style="--k:4" x="37.8" y="7" width="5.5" height="35"/>' +
      '<path class="pitch-draw pitch-draw--late pitch-draw--amber" pathLength="1" d="M2 18.5H46"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      '<path class="pitch-draw" pathLength="1" d="M4 16h5M11 16h5M18 16h5M25 16h5M32 16h5M39 16h5"/>' +
      '<path class="pitch-draw pitch-draw--late" pathLength="1" d="M4 32H44"/>' +
      '<path class="pitch-tint pitch-tint--solid" d="M15 28l4 4-4 4-4-4zM27 28l4 4-4 4-4-4zM39 28l4 4-4 4-4-4z"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      '<path class="pitch-draw" pathLength="1" d="M31.5 11A15 15 0 1 1 16.5 11"/>' +
      '<path class="pitch-draw pitch-draw--late" pathLength="1" d="M11 10.5L16.5 11L14.2 16"/>' +
      '<circle class="pitch-tint pitch-tint--green" cx="24" cy="24" r="3.4"/></svg>'
  ];

  // The title before the film: each word rises in turn, and a word marked *like this* is lit
  function posterTitle(text) {
    return String(text).split(/\s+/).filter(Boolean).map(function (w, k) {
      return '<span class="pitch-w' + (/\*/.test(w) ? ' pitch-w--key' : '') + '"><span class="pitch-anim" style="--d:' +
        (0.15 + k * 0.08).toFixed(2) + 's">' + esc(plain(w)) + '</span></span>';
    }).join(' ');
  }

  // ----- light in the frame: motes that drift through it, and sparks when something happens -----
  // A canvas over the photographs. It only runs while the film is on screen and the tab is visible.
  function Fx(canvas, stage) {
    this.c = canvas;
    this.stage = stage;
    this.g = canvas.getContext('2d');
    this.motes = [];
    this.sparks = [];
    this.w = 0; this.h = 0; this.dpr = 1;
    this.energy = 0.35;              // how lively the motes are; set from the scene
    this.tint = [255, 255, 255];     // their colour; set from the line
    this.glow = 0;                   // the beat
    this.raf = 0;
    this.visible = false;
    this.last = 0;
    this.size();
    for (var i = 0; i < this.count(); i++) this.motes.push(this.mote(true));
  }
  Fx.prototype.count = function () { return this.w < 560 ? 46 : 96; };
  Fx.prototype.size = function () {
    var r = this.stage.getBoundingClientRect();
    this.dpr = Math.min(1.75, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.c.width = Math.max(1, Math.round(r.width * this.dpr));
    this.c.height = Math.max(1, Math.round(r.height * this.dpr));
  };
  Fx.prototype.mote = function (anywhere) {
    var z = 0.25 + Math.random() * 0.75;              // nearer motes are larger, brighter and faster
    return {
      x: Math.random() * this.w,
      y: anywhere ? Math.random() * this.h : -10,
      z: z,
      r: 0.6 + z * z * 2.6,
      vx: (0.15 + Math.random() * 0.5) * z,
      vy: (0.25 + Math.random() * 0.55) * z,
      ph: Math.random() * 6.28,
      a: 0.25 + Math.random() * 0.55
    };
  };
  Fx.prototype.burst = function (x, y, color, n, power) {
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = (0.4 + Math.random()) * (power || 1);
      this.sparks.push({ x: x, y: y, vx: Math.cos(ang) * sp * 5.5, vy: Math.sin(ang) * sp * 4.2 - 2.2, life: 1, decay: 0.012 + Math.random() * 0.018, r: 0.8 + Math.random() * 2, col: color });
    }
  };
  Fx.prototype.streak = function (y, color) {        // a line of light that races across the frame
    this.flash = { y: y, x: -0.2 * this.w, col: color, life: 1 };
  };
  Fx.prototype.run = function (on) {
    var self = this;
    if (on === this.visible) return;
    this.visible = on;
    cancelAnimationFrame(this.raf);
    if (on) { this.last = performance.now(); this.raf = requestAnimationFrame(function step(now) { self.frame(now); if (self.visible) self.raf = requestAnimationFrame(step); }); }
  };
  Fx.prototype.frame = function (now) {
    var dt = Math.min(50, now - this.last) / 16.67;
    this.last = now;
    var g = this.g, w = this.w, h = this.h, d = this.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    var e = this.energy, t = this.tint, pulse = this.glow;
    for (var i = 0; i < this.motes.length; i++) {
      var m = this.motes[i];
      m.ph += 0.02 * dt;
      m.x += (m.vx * (0.6 + e * 1.6) + Math.sin(m.ph) * 0.25 * m.z) * dt;
      m.y += m.vy * (0.6 + e * 1.2) * dt;
      if (m.y > h + 10 || m.x > w + 10) { this.motes[i] = this.mote(false); if (Math.random() < 0.5) { this.motes[i].x = -10; this.motes[i].y = Math.random() * h; } continue; }
      var a = m.a * (0.55 + 0.45 * Math.sin(m.ph * 1.7)) * (0.7 + pulse * 0.9 * m.z);
      var rad = m.r * (1 + pulse * 0.6 * m.z);
      var gr = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, rad * 3);
      gr.addColorStop(0, 'rgba(' + t[0] + ',' + t[1] + ',' + t[2] + ',' + (a * 0.9).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + t[0] + ',' + t[1] + ',' + t[2] + ',0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(m.x, m.y, rad * 3, 0, 6.2832);
      g.fill();
    }
    for (var k = this.sparks.length - 1; k >= 0; k--) {
      var s = this.sparks[k];
      s.vy += 0.09 * dt;
      s.vx *= Math.pow(0.985, dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= s.decay * dt;
      if (s.life <= 0) { this.sparks.splice(k, 1); continue; }
      g.strokeStyle = 'rgba(' + s.col + ',' + s.life.toFixed(3) + ')';
      g.lineWidth = s.r;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x - s.vx * 2.2, s.y - s.vy * 2.2);
      g.stroke();
    }
    if (this.flash) {
      var fl = this.flash;
      fl.x += w * 0.045 * dt;
      fl.life -= 0.022 * dt;
      if (fl.life <= 0 || fl.x > w * 1.3) this.flash = null;
      else {
        var lg = g.createLinearGradient(fl.x - w * 0.35, 0, fl.x, 0);
        lg.addColorStop(0, 'rgba(' + fl.col + ',0)');
        lg.addColorStop(1, 'rgba(' + fl.col + ',' + (0.95 * fl.life).toFixed(3) + ')');
        g.fillStyle = lg;
        g.fillRect(fl.x - w * 0.35, fl.y - 1.5, w * 0.35, 3);
        var hg = g.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, h * 0.35);
        hg.addColorStop(0, 'rgba(' + fl.col + ',' + (0.55 * fl.life).toFixed(3) + ')');
        hg.addColorStop(1, 'rgba(' + fl.col + ',0)');
        g.fillStyle = hg;
        g.beginPath();
        g.arc(fl.x, fl.y, h * 0.35, 0, 6.2832);
        g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
  };

  function build(root, data) {
    var scenes = data.scenes || [];
    var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    function secs(i) { return Number(scenes[i].seconds) || 6; }

    var starts = [];
    var total = 0;
    scenes.forEach(function (s, i) { starts.push(total); total += secs(i) * 1000; });

    var line = data.line || {};
    var withSound = data.sound !== false && !!(window.PitchSound && window.PitchSound.supported);

    // ----- backdrops: one layer per photograph, pushed in slowly while its scenes run -----
    var images = [];
    var focus = [];                    // which part of a tall photograph to show: top, center or bottom
    var bgOf = scenes.map(function (s) {
      var src = String(s.image || '').trim();
      if (!src) return -1;
      var k = images.indexOf(src);
      if (k < 0) { images.push(src); focus.push(/^(top|bottom)$/.test(s.focus) ? s.focus : 'center'); k = images.length - 1; }
      return k;
    });
    var runOf = scenes.map(function (s, i) {
      var a = i, b = i;
      while (a > 0 && bgOf[a - 1] === bgOf[i]) a--;
      while (b < scenes.length - 1 && bgOf[b + 1] === bgOf[i]) b++;
      return [starts[a], starts[b] + secs(b) * 1000];
    });
    // The picture is laid out twice, as a left and a right half, so that it can part where the gap is.
    var stack = '<div class="pitch-bgs">' +
      images.map(function (src, k) { return '<div class="pitch-bg pitch-bg--' + focus[k] + '" data-src="' + esc(src) + '"></div>'; }).join('') + '</div>';
    // The ones who have to say yes: one post in the opening for each name in the scene that lists them
    var gateScene = -1;
    scenes.forEach(function (s, i) { if (gateScene < 0 && s.line === 'gap' && s.figure === 'grid' && (s.items || []).length) gateScene = i; });
    var gateCount = gateScene >= 0 ? Math.min(6, scenes[gateScene].items.length) : 0;
    var gateAt = [];                   // when each post rises (ms into its scene); filled in where the scenes are built
    var posts = '';
    for (var g = 0; g < gateCount; g++) posts += '<i class="pitch-gate"></i>';
    var bgsHtml = '<div class="pitch-world" aria-hidden="true">' +
      '<div class="pitch-half pitch-half--l">' + stack + '</div><div class="pitch-half pitch-half--r">' + stack + '</div></div>' +
      '<div class="pitch-shade" aria-hidden="true"></div>' +
      '<canvas class="pitch-fx" aria-hidden="true"></canvas>' +
      '<div class="pitch-chasm" aria-hidden="true"><span class="pitch-gates">' + posts + '</span></div>' +
      '<div class="pitch-seam" aria-hidden="true"></div>';

    // ----- the dot that travels the line: where it should be at the end of each scene -----
    // 'edge' = stopped at the gap, a number = how far along the stretch after the gap (0 to 1)
    var bridgeScenes = [];
    scenes.forEach(function (s, i) { if (s.line === 'bridge') bridgeScenes.push(i); });
    var dotAt = [];
    scenes.forEach(function (s, i) {
      var x = i ? dotAt[i - 1] : 'start';
      if (s.line === 'base' || s.line === 'gap') x = 'edge';
      else if (s.line === 'bridge') {
        var k = bridgeScenes.indexOf(i);
        x = bridgeScenes.length > 1 ? k / (bridgeScenes.length - 1) : 1;
      }
      dotAt.push(x);
    });
    var gapFrom = 0.41, gapTo = 0.59;                             // measured from the layout in measure()
    function place(x) {
      if (x === 'start') return 0.02;
      if (x === 'edge') return gapFrom - 0.018;
      return gapTo + 0.018 + (0.985 - gapTo - 0.018) * x;
    }
    // When each scene's headline has landed (ms), and how long a scene waits for the cut to pass (s).
    // Both are filled in where the scenes are built, below.
    var landAt = [];
    var leadOf = [];
    var itemAt = [];                   // when each item of a scene lands (ms into the scene), for the sound
    var hitAt = [];
    var ctaAtLocal = null;
    var INTRO = 1.0;                   // seconds of cold open before the first words
    function dotX(i, local) {
      var from = place(i ? dotAt[i - 1] : 'start');
      var to = place(dotAt[i]);
      if (from === to || calm) return to;
      if (scenes[i].line === 'base') {                            // runs up, and reaches the edge as the line lands
        return from + (to - from) * easeOut(clamp01((local - 350) / Math.max(1200, landAt[i] - 350)));
      }
      var firstBridge = scenes[i].line === 'bridge' && (!i || scenes[i - 1].line !== 'bridge');
      var delay = firstBridge ? landAt[i] + 620 : 300 + leadOf[i] * 1000;   // wait for the picture to close
      return from + (to - from) * ease(clamp01((local - delay) / (firstBridge ? 1500 : 1400)));
    }
    // The gap opens, and later closes, at the moment the headline that says so has landed
    function lineState(i, local) {
      var now = scenes[i].line || 'none';
      var before = i ? (scenes[i - 1].line || 'none') : 'none';
      if (!calm && i && now !== before && (now === 'gap' || now === 'bridge') && local < landAt[i]) return before;
      return now;
    }

    // How far the picture has parted above the gap: 0 is whole, 1 is as wide as the gap in the line.
    // It breaks open, a little too far and back, when the headline that names the gap has landed,
    // and closes when the headline that bridges it has landed and the posts have given way.
    function splitAt(i, local) {
      var now = scenes[i].line || 'none';
      var before = i ? (scenes[i - 1].line || 'none') : 'none';
      if (now === 'gap') {
        if (calm || before === 'gap') return 1;
        var p = clamp01((local - landAt[i]) / 520) - 1;
        return 1 + 2.70158 * p * p * p + 1.70158 * p * p;
      }
      if (now === 'bridge' && before === 'gap' && !calm) {
        var q = clamp01((local - landAt[i] - 250) / 420);
        return 1 - q * q * q;
      }
      return 0;
    }
    // What each post is doing: standing, turned green (a yes), and gone
    function gateState(k, i, local) {
      if (gateScene < 0 || i < gateScene) return 0;
      var now = scenes[i].line || 'none';
      if (i === gateScene) return (calm || local >= gateAt[k]) ? 1 : 0;
      if (now === 'gap') return 1;
      if (now === 'bridge' && scenes[i - 1].line === 'gap' && !calm) {
        var yes = landAt[i] - 330 + k * 110;
        return local >= yes + 230 ? 3 : local >= yes ? 2 : 1;
      }
      return 0;
    }

    // ----- scenes -----
    var scenesHtml = scenes.map(function (s, i) {
      var seconds = secs(i);
      var fig = String(s.figure || '').replace(/[^a-z]/g, '');
      var words = String(s.headline || '').split(/\s+/).filter(Boolean);
      var step = 0.055;
      // a new photograph arrives behind a sweep across the frame: the text waits for it to pass
      var lead = (!calm && i > 0 && bgOf[i] !== bgOf[i - 1]) ? 0.3 : 0;
      if (!calm && i === 0) lead = INTRO;                    // the cold open comes first
      // a statement holds its last word back for a beat
      var beat = (s.type !== 'list' && words.length > 2) ? 0.3 : 0;
      var headline = words.map(function (w, k) {
        var held = beat && k === words.length - 1;
        var key = /\*/.test(w);
        return '<span class="pitch-w' + (held ? ' pitch-w--beat' : '') + (key ? ' pitch-w--key' : '') + '"><span class="pitch-anim" style="--d:' +
          (lead + 0.2 + k * step + (held ? beat : 0)).toFixed(2) + 's">' + esc(plain(w)) + '</span></span>';
      }).join(' ');
      var t = lead + 0.2 + words.length * step + beat + 0.5;  // when the headline has landed
      leadOf[i] = lead;
      landAt[i] = (t - 0.15) * 1000;
      var mark = '';
      var hit = t;                                            // when the scene's mark strikes (the red line)
      if (fig === 'redline') {
        mark = '<span class="pitch-redline" style="--d:' + t.toFixed(2) + 's"></span>';
        t += 0.9;
      }
      var items = Array.isArray(s.items) ? s.items : [];
      var hold = 1.4;                                         // seconds everything stays before the scene ends
      var room = Math.max(0.3, seconds - hold - t - (s.detail ? 0.8 : 0));
      var itemStep = items.length ? Math.min(0.6, room / items.length) : 0;
      var itemsHtml = items.map(function (it, k) {
        var d = (t + k * itemStep).toFixed(2);
        var lead = fig === 'frameworks' ? '<span class="pitch-glyph">' + (GLYPHS[k % GLYPHS.length]) + '</span>'
          : (fig === 'grid' || fig === 'columns') ? '<i class="pitch-rule"></i>' : '';
        return '<li style="--d:' + d + 's">' + lead + '<span class="pitch-item pitch-anim">' + itemHtml(it) + '</span></li>';
      }).join('');
      if (i === gateScene) gateAt = items.map(function (it, k) { return (t + k * itemStep) * 1000; });
      itemAt[i] = items.map(function (it, k) { return (t + k * itemStep) * 1000; });
      hitAt[i] = hit * 1000;
      var after = t + items.length * itemStep + (items.length ? 0.2 : 0.2);
      var detail = s.detail
        ? '<p class="pitch-detail pitch-anim" style="--d:' + after.toFixed(2) + 's">' + esc(s.detail) + '</p>' : '';
      if (s.type === 'close' && data.cta_url) ctaAtLocal = (after + 0.7) * 1000;
      var cta = s.type === 'close' && data.cta_url
        ? '<p class="pitch-cta pitch-anim" style="--d:' + (after + 0.7).toFixed(2) + 's"><a class="btn btn--light" href="' + esc(data.cta_url) + '">' + esc(data.cta_label || 'Are we a match?') + '</a></p>' : '';
      return '<div class="pitch-scene pitch-scene--' + esc(s.type || 'statement') + (fig ? ' pitch-fig--' + fig : '') + (s.line === 'gap' ? ' pitch-scene--gapped' : '') + '" data-items="' + items.length +
        '" data-fig="' + fig + '" style="--dur:' + seconds + 's;--hit:' + hit.toFixed(2) + 's" aria-hidden="true">' +
        '<p class="pitch-headline">' + headline + '</p>' + mark +
        (items.length ? '<ul class="pitch-items">' + itemsHtml + '</ul>' : '') + detail + cta + '</div>';
    }).join('');

    // ----- the line with a gap in it, and the dot that has to cross it -----
    var lineHtml =
      '<div class="pitch-line" aria-hidden="true">' +
      '<span class="pitch-seg pitch-seg--left"><i></i><b>' + esc(line.left || '') + '</b></span>' +
      '<span class="pitch-seg pitch-seg--gap"><i></i><b class="pitch-gap-label">' + esc(line.gap || '') + '</b><b class="pitch-bridge-label">' + esc(line.bridge || '') + '</b></span>' +
      '<span class="pitch-seg pitch-seg--right"><i></i><b>' + esc(line.right || '') + '</b></span>' +
      '<span class="pitch-dot"><b></b></span>' +
      '</div>';

    var segs = scenes.map(function (s, i) {
      return '<button type="button" class="pitch-step" data-seek="' + i + '" style="flex-grow:' + secs(i) + '" aria-label="Go to part ' + (i + 1) + ' of ' + scenes.length + '"><span></span></button>';
    }).join('');

    var transcript = scenes.map(function (s) {
      var items = (s.items || []).length ? ' ' + s.items.map(esc).join('. ') + '.' : '';
      return '<li>' + esc(plain(s.headline)) + items + (s.detail ? ' ' + esc(s.detail) : '') + '</li>';
    }).join('');

    root.innerHTML =
      '<div class="pitch-stage" role="group" aria-label="One-minute pitch. Animation' + (withSound ? ' with sound' : '') + '." data-line="none">' +
      bgsHtml + lineHtml + scenesHtml +
      '<div class="pitch-wipe" aria-hidden="true"></div>' +
      '<div class="pitch-poster">' +
      '<p class="pitch-headline pitch-poster-title">' + posterTitle(data.poster_title || 'The pitch in one minute') + '</p>' +
      '<p class="pitch-poster-row">' +
      '<button type="button" class="pitch-start" data-act="toggle"><span class="pitch-start-disc" aria-hidden="true"><span class="pitch-icon"></span></span><span class="pitch-start-label">' + esc(data.play_label || 'Play') + '</span></button>' +
      (data.poster_note ? '<span class="pitch-poster-note">' + esc(data.poster_note) + '</span>' : '') +
      '</p>' +
      '</div>' +
      '</div>' +
      '<div class="pitch-controls">' +
      '<button type="button" class="pitch-toggle" data-act="toggle" aria-label="Play"><span class="pitch-icon" aria-hidden="true"></span></button>' +
      '<div class="pitch-steps">' + segs + '</div>' +
      '<span class="pitch-time" aria-hidden="true">0:00 / ' + clock(total) + '</span>' +
      (withSound ? '<button type="button" class="pitch-sound" data-act="sound" aria-pressed="true" aria-label="Sound on"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="pitch-sound-body" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="pitch-sound-on" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/><path class="pitch-sound-off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg></button>' : '') +
      '</div>' +
      '<details class="pitch-transcript"><summary>' + esc(data.transcript_label || 'Read the pitch as text') + '</summary><ol>' + transcript + '</ol></details>';

    var stage = root.querySelector('.pitch-stage');
    var sceneEls = root.querySelectorAll('.pitch-scene');
    var stepEls = root.querySelectorAll('.pitch-step');
    var bgEls = root.querySelectorAll('.pitch-bg');          // every photograph twice: left half first, then right half
    var worldEl = root.querySelector('.pitch-world');
    var seamEl = root.querySelector('.pitch-seam');
    var gateEls = root.querySelectorAll('.pitch-gate');
    function eachBg(k, fn) { for (var h = 0; h < 2; h++) { var el = bgEls[h * images.length + k]; if (el) fn(el); } }
    var lineEl = root.querySelector('.pitch-line');
    var wipeEl = root.querySelector('.pitch-wipe');
    var toggle = root.querySelector('.pitch-toggle');
    var timeEl = root.querySelector('.pitch-time');
    var fx = calm ? null : new Fx(root.querySelector('.pitch-fx'), stage);
    var soundBtn = root.querySelector('.pitch-sound');

    // ----- sound -----
    var BEAT = 625;                    // the pulse of the soundtrack, which the light follows too (96 a minute)
    var sound = null;
    var soundOn = true;
    try { soundOn = window.localStorage.getItem('attolloo-pitch-sound') !== 'off'; } catch (e) { /* no storage */ }
    function figOf(i) { return String(scenes[i].figure || '').replace(/[^a-z]/g, ''); }
    function soundPlan() {
      var firstGap = -1, firstBridge = -1, close = -1;
      scenes.forEach(function (s, i) {
        if (firstGap < 0 && s.line === 'gap') firstGap = i;
        if (firstBridge < 0 && s.line === 'bridge' && i && scenes[i - 1].line === 'gap') firstBridge = i;
        if (close < 0 && s.type === 'close') close = i;
      });
      var plan = {
        total: total,
        beatMs: BEAT,
        introAt: calm ? null : 250,
        scenes: scenes.map(function (s, i) {
          return {
            start: starts[i], end: starts[i] + secs(i) * 1000, line: s.line || 'none', fig: figOf(i),
            land: starts[i] + landAt[i], first: i === firstGap || i === firstBridge,
            split: starts[i] + landAt[i], seal: starts[i] + landAt[i] + 600, hit: starts[i] + (hitAt[i] || 0)
          };
        }),
        wipes: [], stampTimes: [], chimeTimes: [],
        crackAt: firstGap >= 0 ? starts[firstGap] + landAt[firstGap] : null,
        sealAt: firstBridge >= 0 ? starts[firstBridge] + landAt[firstBridge] + 600 : null,
        gateTimes: gateScene >= 0 ? gateAt.map(function (x) { return starts[gateScene] + x; }) : [],
        ctaAt: close >= 0 && ctaAtLocal != null ? starts[close] + ctaAtLocal : null
      };
      scenes.forEach(function (s, i) {
        if (i > 0 && bgOf[i] >= 0 && bgOf[i] !== bgOf[i - 1]) plan.wipes.push(starts[i]);
        var fig = figOf(i);
        if (fig === 'tags') itemAt[i].forEach(function (x) { plan.stampTimes.push(starts[i] + x); });
        if (fig === 'frameworks') itemAt[i].forEach(function (x) { plan.chimeTimes.push(starts[i] + x + 120); });
      });
      return plan;
    }
    function soundReady() {
      if (!withSound) return null;
      if (!sound) {
        sound = window.PitchSound.create(soundPlan(), { voiceUrl: String(data.voice_url || '').trim() });
        sound.setMuted(!soundOn);
      }
      return sound;
    }
    function showSound() {
      if (!soundBtn) return;
      soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
      soundBtn.classList.toggle('is-off', !soundOn);
    }
    showSound();

    // ----- the beat, and what the light does in each part of the story -----
    function energyOf(i) {
      var s = scenes[i];
      if (s.line === 'gap') return 0.75;
      if (s.line === 'bridge') return figOf(i) === 'redline' ? 0.35 : 1;
      return 0.4;
    }
    function tintOf(i) {
      var s = scenes[i];
      if (figOf(i) === 'redline') return [255, 160, 160];
      if (s.line === 'gap') return [255, 214, 150];
      if (s.line === 'bridge') return [196, 255, 216];
      return [255, 255, 255];
    }
    var lastLocal = 0, wasArrived = false;

    var t = 0, playing = false, current = -1, last = 0, raf = 0;
    var stepping = false;             // set when the film is stepped frame by frame to make a video file
    var shownBg = -1;                 // the photograph on screen
    var shownLine = '';               // the state of the line on screen
    var lastX = null, lastT = 0, tail = 0;   // for the streak behind the dot
    var shownSplit = null;            // how far the picture has parted on screen
    var shownGates = [];              // what each post is doing on screen

    worldEl.addEventListener('animationend', function () { stage.classList.remove('is-cracking'); });
    seamEl.addEventListener('animationend', function () { stage.classList.remove('is-sealed'); });
    function pulse(name) { stage.classList.remove(name); void stage.offsetWidth; stage.classList.add(name); }

    wipeEl.addEventListener('animationend', function () { stage.classList.remove('is-wiping'); });
    // A long pause between frames (a sleeping tab) must not skip the film ahead; a recording keeps real time.
    var frameCap = /[?&]record\b/.test(location.search) ? 1000 : 100;

    function measure() {
      var gap = root.querySelector('.pitch-seg--gap');
      var w = lineEl.offsetWidth;
      if (!gap || !w) return;
      gapFrom = gap.offsetLeft / w;
      gapTo = (gap.offsetLeft + gap.offsetWidth) / w;
      // where the picture parts: straight above the gap in the line
      var left = lineEl.offsetLeft + gap.offsetLeft;
      var wide = gap.offsetWidth;
      stage.style.setProperty('--gapl', left + 'px');
      stage.style.setProperty('--gapw', wide + 'px');
      stage.style.setProperty('--cut', (left + wide / 2) + 'px');
      stage.style.setProperty('--half', (wide / 2) + 'px');
      stage.style.setProperty('--rail', (stage.offsetHeight - lineEl.offsetTop) + 'px');
      stage.style.setProperty('--clear', (stage.offsetWidth - left + stage.offsetWidth * 0.035) + 'px');
    }

    function loadBg(k) {
      eachBg(k, function (el) {
        if (el.style.backgroundImage) return;
        el.style.backgroundImage = 'url("' + el.getAttribute('data-src').replace(/["\\\n\r]/g, '') + '")';
      });
    }
    function showBg(k) {
      bgEls.forEach(function (el, n) { el.classList.toggle('is-on', n % images.length === k); });
    }

    function show(i, restart) {
      if (i === current && !restart) return;
      var from = current;
      current = i;
      sceneEls.forEach(function (el, k) {
        var on = k === i;
        el.classList.remove('is-active', 'is-leaving');
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) { void el.offsetWidth; el.classList.add('is-active'); }   // restart its animations
      });
      if (from >= 0 && from !== i && !calm) {
        sceneEls[from].classList.add('is-leaving');   // the old text lifts away
        if (playing) pulse('is-kick');                // and the camera is nudged forward
      }
      if (fx) { fx.energy = energyOf(i); fx.tint = tintOf(i); }

      // what the scene does to the whole frame (the red tint of the red-line scene)
      stage.removeAttribute('data-fig');
      void stage.offsetWidth;
      stage.setAttribute('data-fig', sceneEls[i].getAttribute('data-fig') || '');
      stage.style.setProperty('--hit', sceneEls[i].style.getPropertyValue('--hit') || '1s');

      // a new photograph comes in behind a sweep across the frame
      var k2 = bgOf[i];
      if (!calm && shownBg >= 0 && k2 >= 0 && k2 !== shownBg && stage.classList.contains('is-started')) {
        stage.classList.remove('is-wiping');
        void wipeEl.offsetWidth;
        stage.classList.add('is-wiping');
      }
      showBg(k2);
      shownBg = k2;
    }

    // How the camera moves over each photograph: push in, pull back, drift upwards. Then the same again.
    function camera(k, p) {
      var m = k % 3;
      if (m === 0) return 'scale(' + (1.08 + 0.2 * p).toFixed(4) + ') translate3d(' + (-3.6 * p).toFixed(3) + '%,' + (0.8 * p).toFixed(3) + '%,0)';
      if (m === 1) return 'scale(' + (1.28 - 0.18 * p).toFixed(4) + ') translate3d(' + (-2.4 + 4 * p).toFixed(3) + '%,0,0) rotate(' + (-0.7 + 1.2 * p).toFixed(3) + 'deg)';
      return 'scale(' + (1.12 + 0.14 * p).toFixed(4) + ') translate3d(0,' + (2.6 - 5.2 * p).toFixed(3) + '%,0)';
    }

    function paint() {
      var i = 0;
      for (var k = 0; k < starts.length; k++) if (t >= starts[k]) i = k;
      show(i, false);
      stepEls.forEach(function (el, k) {
        var p = clamp01((t - starts[k]) / (secs(k) * 1000));
        el.firstChild.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      });
      timeEl.textContent = clock(t) + ' / ' + clock(total);

      // the line: its gap opens and closes when the headline says so
      var state = lineState(i, t - starts[i]);
      if (state !== shownLine) { shownLine = state; stage.setAttribute('data-line', state); }

      // the dot on the line, with a streak behind it that grows with its speed
      var x = dotX(i, t - starts[i]);
      lineEl.style.setProperty('--x', x.toFixed(4));
      stage.classList.toggle('is-arrived', x > 0.975);
      var dt = t - lastT;
      var speed = (lastX != null && dt > 0 && dt < 200) ? Math.max(0, x - lastX) / dt : 0;   // share of the line per ms
      tail += ((calm ? 0 : Math.min(1, speed * 2600)) - tail) * 0.3;
      lineEl.style.setProperty('--tail', (tail < 0.01 ? 0 : tail).toFixed(3));
      lastX = x;
      lastT = t;

      // the picture parts above the gap, and closes when the gap is bridged
      var split = splitAt(i, t - starts[i]);
      if (split !== shownSplit) {
        stage.style.setProperty('--split', split.toFixed(4));
        stage.classList.toggle('is-split', split > 0.001);
        if (shownSplit != null && playing && !calm) {
          if (shownSplit <= 0.001 && split > 0.001 && scenes[i].line === 'gap') pulse('is-cracking');    // the jolt as it breaks
          if (shownSplit > 0.001 && split <= 0.001 && scenes[i].line === 'bridge') pulse('is-sealed');   // the light as it closes
        }
        shownSplit = split;
      }
      for (var g2 = 0; g2 < gateEls.length; g2++) {
        var gs = gateState(g2, i, t - starts[i]);
        if (gs === shownGates[g2]) continue;
        shownGates[g2] = gs;
        gateEls[g2].classList.toggle('is-on', gs >= 1);
        gateEls[g2].classList.toggle('is-yes', gs >= 2);
        gateEls[g2].classList.toggle('is-open', gs >= 3);
      }

      // the beat: a pulse of light on every beat (every other beat at the start), stronger as the story builds
      var local = t - starts[i];
      var per = (scenes[i].line === 'base' || scenes[i].line === 'none' || figOf(i) === 'redline') ? BEAT * 2 : BEAT;
      var beatOn = !calm && t > (starts[0] + (landAt[0] || 0));
      var ph = (t % per) / per;
      var pulseNow = beatOn ? energyOf(i) * Math.exp(-ph * 5) : 0;
      stage.style.setProperty('--pulse', pulseNow.toFixed(3));
      if (fx) {
        fx.glow = pulseNow;
        // sparks where the picture breaks and closes, and at the red line
        var cx = lineEl.offsetLeft + (gapFrom + gapTo) / 2 * lineEl.offsetWidth;
        var cy = lineEl.offsetTop;
        if (playing && scenes[i].line === 'gap' && (!i || scenes[i - 1].line !== 'gap') && lastLocal < landAt[i] && local >= landAt[i]) fx.burst(cx, cy, '255,206,120', 110, 1.35);
        if (playing && scenes[i].line === 'bridge' && i && scenes[i - 1].line === 'gap' && lastLocal < landAt[i] + 600 && local >= landAt[i] + 600) { fx.burst(cx, cy, '160,255,190', 130, 1.5); fx.streak(cy, '210,255,225'); }
        if (playing && figOf(i) === 'redline' && lastLocal < hitAt[i] && local >= hitAt[i]) fx.burst(stage.offsetWidth * 0.32, stage.offsetHeight * 0.5, '255,110,110', 90, 1.2);
        var arrived = x > 0.975;
        if (playing && arrived && !wasArrived) fx.burst(lineEl.offsetLeft + lineEl.offsetWidth * 0.985, cy, '160,255,190', 70, 1);
        wasArrived = arrived;
      }
      lastLocal = local;
      if (t > 2200) stage.classList.remove('is-intro');

      // the camera never stands still on the photograph behind this scene
      if (bgOf[i] >= 0) {
        var p2 = calm ? 0 : clamp01((t - runOf[i][0]) / (runOf[i][1] - runOf[i][0]));
        var move = camera(bgOf[i], 1 - (1 - p2) * (1 - p2));
        eachBg(bgOf[i], function (el) { el.style.transform = move; });
      }
    }

    function setPlaying(on) {
      playing = on;
      stage.classList.toggle('is-playing', on);
      stage.classList.toggle('is-paused', !on && stage.classList.contains('is-started') && t < total);
      toggle.setAttribute('aria-label', on ? 'Pause' : (t >= total ? (data.replay_label || 'Play again') : 'Play'));
      toggle.classList.toggle('is-on', on);
      cancelAnimationFrame(raf);
      if (on && !stepping) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }

    function tick(now) {
      if (!playing) return;
      t += Math.min(frameCap, now - last);
      last = now;
      if (t >= total) {
        t = total;
        paint();
        stage.classList.add('is-ended');
        setPlaying(false);
        if (sound) sound.finish();
        return;
      }
      paint();
      raf = requestAnimationFrame(tick);
    }

    function start(from) {
      measure();
      for (var k = 0; k < images.length; k++) loadBg(k);
      stage.classList.add('is-started');
      stage.classList.remove('is-ended', 'is-cracking', 'is-sealed');
      t = from;
      current = -1;
      lastX = null;
      tail = 0;
      shownSplit = null;
      lastLocal = -1;
      wasArrived = false;
      var snd = soundReady();
      if (snd) snd.play(from);
      if (from === 0 && !calm) {
        pulse('is-intro');                            // the cold open: out of the dark, behind a flare
        if (fx) fx.streak(lineEl.offsetTop, '255,248,230');
      } else {
        stage.classList.remove('is-intro');
      }
      paint();
      setPlaying(true);
    }
    function pauseAll() { setPlaying(false); if (sound) sound.pause(); }
    function resumeAll() { setPlaying(true); if (sound) sound.resume(); }

    root.addEventListener('click', function (e) {
      var seek = e.target.closest('[data-seek]');
      if (seek) { start(starts[Number(seek.getAttribute('data-seek'))]); return; }
      if (e.target.closest('[data-act="sound"]')) {
        soundOn = !soundOn;
        try { window.localStorage.setItem('attolloo-pitch-sound', soundOn ? 'on' : 'off'); } catch (e2) { /* no storage */ }
        showSound();
        var snd = soundReady();
        if (snd) {
          snd.setMuted(!soundOn);
          if (soundOn && playing && !snd.bus) snd.play(t);
        }
        return;
      }
      if (!e.target.closest('[data-act="toggle"]')) return;
      if (!stage.classList.contains('is-started') || t >= total) start(0);
      else if (playing) pauseAll();
      else resumeAll();
    });

    // Pause when the film is out of view or the tab is hidden
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && playing) pauseAll();
      if (fx) fx.run(!document.hidden && onScreen);
    });
    var onScreen = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (playing && entries[0].intersectionRatio < 0.25) pauseAll();
        onScreen = entries[0].isIntersecting;
        if (onScreen) stage.classList.add('is-ready');      // the title rises the first time the film is seen
        if (fx) fx.run(onScreen && !document.hidden);
      }, { threshold: [0, 0.25, 1] }).observe(stage);
    } else {
      stage.classList.add('is-ready');
      if (fx) fx.run(true);
    }

    // "Watch the one-minute pitch" elsewhere on the page: scroll to the film, then start it
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[data-pitch-play]');
      if (!link || !document.body.contains(stage)) return;
      e.preventDefault();
      var snd = soundReady();
      if (snd) snd.prime();                           // the click lets the sound start once the film is reached
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

    // Poster: the first photograph, a title, the play button and the line with its gap
    stage.setAttribute('data-line', 'gap');
    shownLine = 'gap';
    measure();
    lineEl.style.setProperty('--x', place('edge').toFixed(4));
    window.addEventListener('resize', function () {
      measure();
      if (fx) fx.size();
      if (stage.classList.contains('is-started')) { if (!playing) paint(); }
      else lineEl.style.setProperty('--x', place('edge').toFixed(4));
    });
    timeEl.textContent = clock(0) + ' / ' + clock(total);
    if (bgEls.length && bgOf[0] >= 0) {
      showBg(bgOf[0]);
      shownBg = bgOf[0];
      eachBg(bgOf[0], function (el) { el.style.transform = camera(bgOf[0], 0); });
      if ('IntersectionObserver' in window) {
        var near = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          near.disconnect();
          loadBg(bgOf[0]);
        }, { rootMargin: '700px 0px' });
        near.observe(stage);
      } else {
        loadBg(bgOf[0]);
      }
    }

    // For recording and testing: /pitch.html?autoplay (add &record to fill the window with the film)
    if (/[?&]record\b/.test(location.search)) {
      document.documentElement.classList.add('pitch-record');
      // the soundtrack as a WAV file, for putting under a screen recording of the film
      window.pitchRenderAudio = function () { return withSound ? window.PitchSound.renderWav(soundPlan()) : Promise.resolve(''); };
      // Frame by frame, for a smooth video file: the film's clock, the light and every CSS animation
      // are moved on by exactly dt milliseconds, and nothing runs on its own in between.
      var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
      var fakeNow = 0;
      function freeze(dt) {
        if (!seen || !document.getAnimations) return;
        document.getAnimations().forEach(function (a) {
          if (!seen.has(a)) { seen.add(a); a.pause(); a.currentTime = 0; }
          else { a.pause(); a.currentTime = (a.currentTime || 0) + dt; }
        });
      }
      window.pitchStepStart = function () {
        stepping = true;
        soundOn = false;
        if (fx) { fx.run(false); fx.last = 0; }
        start(0);
        freeze(0);
        return total;
      };
      window.pitchFrame = function (dt) {
        t = Math.min(total, t + dt);
        paint();
        if (t >= total) stage.classList.add('is-ended');
        if (fx) { fakeNow += dt; fx.frame(fakeNow); }
        freeze(dt);
        return t;
      };
    }
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
