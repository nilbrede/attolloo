// /js/pitch-sound.js — the sound for the one-minute pitch.
// Everything is made in the browser with the Web Audio API: no music files, no licences, nothing to load.
// /js/pitch.js hands over a plan of the film (when each scene starts, when the gap opens and closes,
// when each item lands), and this file turns it into a score that follows the story:
// a low pulse while the company runs at the gap, a deep hit when the picture breaks, a stamp for each rule,
// a rising sweep and a bright chord when the gap is bridged, a dark drop at the red line, and a full chord at the end.
// The score is scheduled a little ahead of the film as it plays, so it starts fast and can be paused and moved.
// An optional voice-over (voice_url in /data/pitch.json) plays in step with the film, with the music turned down under it.
(function () {
  'use strict';

  var AC = window.AudioContext || window.webkitAudioContext;

  // note names to frequencies (A4 = 440)
  var N = {};
  (function () {
    var names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    for (var o = 1; o <= 6; o++) {
      for (var k = 0; k < 12; k++) N[names[k] + o] = 440 * Math.pow(2, (o * 12 + k - 57) / 12);
    }
  })();
  function f(names) { return names.map(function (n) { return N[n]; }); }

  // The harmony follows the line: D minor and its neighbours while there is a gap, D major once it is bridged.
  var GAP_CHORDS = [f(['Bb2', 'F3', 'D4']), f(['G2', 'D3', 'Bb3']), f(['A2', 'D3', 'E3', 'A3'])];
  var GAP_BASS = [N.Bb1, N.G1, N.A1];
  var BRIDGE_CHORDS = [f(['D3', 'F#3', 'A3', 'D4']), f(['G2', 'D3', 'G3', 'B3']), f(['B2', 'F#3', 'B3', 'D4'])];
  var BRIDGE_BASS = [N.D2, N.G1, N.B1];
  var ARPS = [f(['D4', 'A4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'A4']), f(['G3', 'D4', 'B3', 'D4', 'G4', 'D4', 'B3', 'D4']), f(['B3', 'F#4', 'D4', 'F#4', 'B4', 'F#4', 'D4', 'F#4'])];
  var CHIMES = f(['D5', 'F#5', 'A5', 'D6', 'E6', 'F#6']);
  var GATE_NOTES = f(['A3', 'C4', 'D4', 'F4', 'G4', 'A4']);

  // ---------- the score: a list of events in film time (ms) ----------
  function compose(plan) {
    var ev = [];
    var beat = plan.beatMs || 625;
    var total = plan.total;
    function add(t, type, o) { o = o || {}; o.t = t; o.type = type; ev.push(o); }

    var gapN = 0, bridgeN = 0;
    plan.scenes.forEach(function (s, i) {
      var a = s.start, b = s.end, len = b - a;
      var isLast = i === plan.scenes.length - 1;
      if (s.line === 'base' || s.line === 'none') {
        add(a, 'pad', { notes: f(['D3', 'A3', 'F4']), dur: len, vol: 0.05, bright: 0.22, attack: 1.6 });
        add(a, 'sub', { freq: N.D2, dur: len, vol: 0.16, attack: 1.2 });
        // a slow pulse starts once the first line has landed
        for (var tb = s.land; tb < b; tb += beat * 2) add(tb, 'kick', { vol: 0.32 });
      } else if (s.line === 'gap') {
        var g = gapN++ % GAP_CHORDS.length;
        add(a, 'pad', { notes: GAP_CHORDS[g], dur: len, vol: 0.055, bright: 0.3 + 0.08 * g, attack: 0.5 });
        add(a, 'sub', { freq: GAP_BASS[g], dur: len, vol: 0.2, attack: 0.3 });
        var from = s.first ? s.split : a;
        for (var tg = from; tg < b; tg += beat) add(tg, 'kick', { vol: 0.5 });
        if (gapN > 1) for (var th = a + beat / 2; th < b; th += beat) add(th, 'tick', { vol: 0.05 + 0.02 * g });
      } else if (s.line === 'bridge') {
        if (s.fig === 'redline') {
          // the music falls away; a low, uneasy drone; one heavy hit when the red line strikes
          add(a, 'pad', { notes: f(['D2', 'A2', 'Eb3']), dur: len, vol: 0.06, bright: 0.12, attack: 0.8 });
          add(a, 'sub', { freq: N.D1 * 2, dur: len, vol: 0.18, attack: 0.6 });
          add(s.hit, 'boom', { vol: 0.95, red: true });
          for (var tr = s.hit + beat * 2; tr < b; tr += beat * 2) add(tr, 'kick', { vol: 0.28 });
        } else {
          var c = isLast ? 0 : bridgeN++ % BRIDGE_CHORDS.length;
          var chord = isLast ? f(['D3', 'F#3', 'A3', 'D4', 'F#4', 'A4']) : BRIDGE_CHORDS[c];
          var startPad = s.first ? s.seal : a;
          add(startPad, 'pad', { notes: chord, dur: b - startPad + (isLast ? 2600 : 0), vol: isLast ? 0.06 : 0.05, bright: isLast ? 0.8 : 0.62, attack: s.first ? 0.15 : 0.6 });
          add(startPad, 'sub', { freq: isLast ? N.D2 : BRIDGE_BASS[c], dur: b - startPad + (isLast ? 2600 : 0), vol: 0.17, attack: 0.2 });
          var arp = ARPS[isLast ? 0 : c];
          var stop = isLast ? b - beat * 2 : b;
          for (var ta = startPad, n = 0; ta < stop; ta += beat / 2, n++) {
            add(ta, 'pluck', { freq: arp[n % arp.length], vol: 0.07 });
            if (n % 2 === 0) add(ta, 'kick', { vol: n % 4 === 0 ? 0.48 : 0.3 });
            else add(ta, 'tick', { vol: 0.045 });
          }
        }
      }
    });

    // the cold open: a hit as the frame comes out of the dark
    if (plan.introAt != null) add(plan.introAt, 'boom', { vol: 0.75 });
    // a whoosh with every sweep that brings in a new photograph
    (plan.wipes || []).forEach(function (t) { add(t, 'whoosh', { vol: 0.32 }); });
    // the picture breaks
    if (plan.crackAt != null) { add(plan.crackAt, 'boom', { vol: 1 }); add(plan.crackAt, 'crack', { vol: 0.5 }); }
    // the ones who have to say yes rise one by one
    (plan.gateTimes || []).forEach(function (t, k) { add(t, 'pluck', { freq: GATE_NOTES[k % GATE_NOTES.length], vol: 0.16, long: true }); });
    // the rules land like stamps
    (plan.stampTimes || []).forEach(function (t) { add(t + 40, 'stamp', { vol: 0.7 }); });
    // the gap is bridged: a rising sweep, then light
    if (plan.sealAt != null) {
      add(plan.sealAt - 1500, 'riser', { dur: 1500, vol: 0.22 });
      add(plan.sealAt, 'shimmer', { notes: f(['D5', 'F#5', 'A5', 'D6']), vol: 0.09 });
      add(plan.sealAt, 'kick', { vol: 0.85 });
    }
    // each framework sounds as it is drawn
    (plan.chimeTimes || []).forEach(function (t, k) { add(t, 'chime', { freq: CHIMES[k % CHIMES.length], vol: 0.1 }); });
    // the button at the end
    if (plan.ctaAt != null) { add(plan.ctaAt, 'shimmer', { notes: f(['A4', 'D5', 'F#5', 'A5', 'D6']), vol: 0.08 }); add(plan.ctaAt, 'kick', { vol: 0.7 }); }

    ev.forEach(function (e) { if (e.dur == null) e.dur = 0; });
    ev.sort(function (x, y) { return x.t - y.t; });
    return ev.filter(function (e) { return e.t < total + 2600; });
  }

  // ---------- the engine ----------
  function Sound(plan, opts) {
    this.plan = plan;
    this.events = compose(plan);
    this.voiceUrl = (opts && opts.voiceUrl) || '';
    this.muted = false;
    this.ctx = null;
    this.timer = 0;
    this.next = 0;
    this.from = 0;
    this.c0 = 0;
    this.bus = null;
    this.voice = null;
  }

  Sound.prototype.ensure = function () {
    if (this.ctx || !AC) return !!this.ctx;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return false; }
    this.graph();
    return true;
  };

  Sound.prototype.graph = function () {
    var ctx = this.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = this.muted ? 0 : 1;
    var trim = ctx.createGain();             // a little headroom, so the big hits do not clip
    trim.gain.value = 0.8;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.out.connect(trim);
    trim.connect(comp);
    comp.connect(ctx.destination);
    // a room for everything to ring in
    var len = Math.floor(ctx.sampleRate * 2.8);
    var ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    var wet = ctx.createGain();
    wet.gain.value = 0.42;
    this.verb.connect(wet);
    wet.connect(this.out);
    var nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var nd = nb.getChannelData(0);
    for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    this.noise = nb;
    if (this.voiceUrl) {
      this.voice = new Audio(this.voiceUrl);
      this.voice.preload = 'auto';
      try {
        var src = ctx.createMediaElementSource(this.voice);
        src.connect(this.out);
      } catch (e2) { /* plays straight to the speakers instead */ }
    }
  };

  // The whole score at once, without playing it: for making a video file of the film (see /pitch.html?record)
  Sound.prototype.render = function () {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var rate = 48000;
    this.ctx = new OAC(2, Math.ceil((this.plan.total / 1000 + 3) * rate), rate);
    this.voiceUrl = '';
    this.graph();
    this.bus = this.ctx.createGain();
    this.bus.connect(this.out);
    this.send = this.ctx.createGain();
    this.send.connect(this.verb);
    this.from = 0;
    this.c0 = 0;
    for (var i = 0; i < this.events.length; i++) this.voiceOf(this.events[i], Math.max(0.001, this.events[i].t / 1000), 0);
    return this.ctx.startRendering();
  };

  // an AudioBuffer as a 16-bit WAV file, base64
  function wav(buf) {
    var ch = buf.numberOfChannels, len = buf.length, rate = buf.sampleRate;
    var bytes = new DataView(new ArrayBuffer(44 + len * ch * 2));
    function str(o, t) { for (var i = 0; i < t.length; i++) bytes.setUint8(o + i, t.charCodeAt(i)); }
    str(0, 'RIFF'); bytes.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, ch, true);
    bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * ch * 2, true); bytes.setUint16(32, ch * 2, true);
    bytes.setUint16(34, 16, true); str(36, 'data'); bytes.setUint32(40, len * ch * 2, true);
    var data = [];
    for (var c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    var o = 44;
    for (var i = 0; i < len; i++) for (var c2 = 0; c2 < ch; c2++) { var v = Math.max(-1, Math.min(1, data[c2][i])); bytes.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    var u8 = new Uint8Array(bytes.buffer), out = '';
    for (var j = 0; j < u8.length; j += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(j, j + 0x8000));
    return btoa(out);
  }

  // called inside a click, so that the browser lets the sound start a moment later
  Sound.prototype.prime = function () {
    if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume();
  };

  Sound.prototype.film = function () {          // where the film is, as the audio clock sees it (ms)
    return this.from + (this.ctx.currentTime - this.c0) * 1000;
  };

  Sound.prototype.play = function (fromMs) {
    if (!this.ensure()) return;
    var ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    this.halt();
    var bus = ctx.createGain();
    bus.gain.value = this.voice ? 0.55 : 1;      // music sits under the voice
    bus.connect(this.out);
    var send = ctx.createGain();
    send.gain.value = 1;
    send.connect(this.verb);
    this.bus = bus;
    this.send = send;
    this.from = fromMs;
    this.c0 = ctx.currentTime + 0.06;
    this.next = 0;
    while (this.next < this.events.length && this.events[this.next].t + this.events[this.next].dur < fromMs) this.next++;
    var self = this;
    this.pump();
    this.timer = setInterval(function () { self.pump(); }, 90);
    if (this.voice) {
      try { this.voice.currentTime = Math.max(0, fromMs / 1000); this.voice.play(); } catch (e) { /* no voice */ }
    }
  };

  // schedule what falls within the next half second
  Sound.prototype.pump = function () {
    if (!this.ctx || !this.bus) return;
    var horizon = this.film() + 500;
    while (this.next < this.events.length && this.events[this.next].t <= horizon) {
      var e = this.events[this.next++];
      var at = this.c0 + (e.t - this.from) / 1000;
      var late = Math.max(0, this.ctx.currentTime - at);
      if (e.dur === 0 && late > 0.08) continue;   // a short sound that is already past is skipped
      this.voiceOf(e, Math.max(at, this.ctx.currentTime + 0.01), late);
    }
  };

  Sound.prototype.pause = function () {
    if (!this.ctx) return;
    clearInterval(this.timer);
    this.timer = 0;
    if (this.voice) try { this.voice.pause(); } catch (e) { /* none */ }
    this.ctx.suspend();
  };

  Sound.prototype.resume = function () {
    if (!this.ctx || !this.bus) return;
    var self = this;
    this.ctx.resume();
    clearInterval(this.timer);
    this.timer = setInterval(function () { self.pump(); }, 90);
    if (this.voice) try { this.voice.play(); } catch (e) { /* none */ }
  };

  // stop everything that is sounding or scheduled, with a short fade so nothing clicks
  Sound.prototype.halt = function () {
    clearInterval(this.timer);
    this.timer = 0;
    if (this.voice) try { this.voice.pause(); } catch (e) { /* none */ }
    if (!this.bus) return;
    var bus = this.bus, send = this.send, now = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(0, now + 0.08);
    send.gain.setValueAtTime(send.gain.value, now);
    send.gain.linearRampToValueAtTime(0, now + 0.08);
    setTimeout(function () { try { bus.disconnect(); send.disconnect(); } catch (e) { /* gone */ } }, 200);
    this.bus = null;
    this.send = null;
  };

  // the end of the film: let the last chord ring, then stop scheduling
  Sound.prototype.finish = function () {
    var self = this;
    setTimeout(function () { clearInterval(self.timer); self.timer = 0; }, 3000);
  };

  Sound.prototype.setMuted = function (on) {
    this.muted = !!on;
    if (!this.out) return;
    var now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(this.muted ? 0 : 1, now + 0.15);
  };

  // ---------- the instruments ----------
  Sound.prototype.env = function (g, at, attack, hold, release, peak) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.setValueAtTime(peak, at + attack + Math.max(0, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + Math.max(0, hold) + release);
  };

  Sound.prototype.noiseSrc = function (at, dur) {
    var s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(at, Math.random() * 1.5);
    s.stop(at + dur + 0.05);
    return s;
  };

  Sound.prototype.voiceOf = function (e, at, late) {
    var ctx = this.ctx, bus = this.bus, send = this.send, self = this;
    var dur, g, o, flt, k;
    switch (e.type) {
      case 'pad': {
        dur = e.dur / 1000 - late;
        if (dur <= 0.2) return;
        var attack = late > 0 ? 0.25 : (e.attack || 1);
        g = ctx.createGain();
        flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.Q.value = 0.7;
        var top = 300 + 2600 * (e.bright || 0.3);
        flt.frequency.setValueAtTime(top * 0.55, at);
        flt.frequency.linearRampToValueAtTime(top, at + Math.min(dur, 3.5));
        flt.connect(g);
        g.connect(bus);
        g.connect(send);
        this.env(g, at, attack, dur - attack - 1.2, 1.6, e.vol);
        e.notes.forEach(function (fr) {
          [-7, 7].forEach(function (cents) {
            var osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = fr;
            osc.detune.value = cents;
            osc.connect(flt);
            osc.start(at);
            osc.stop(at + dur + 0.5);
          });
        });
        return;
      }
      case 'sub': {
        dur = e.dur / 1000 - late;
        if (dur <= 0.2) return;
        g = ctx.createGain();
        o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = e.freq;
        o.connect(g);
        g.connect(bus);
        this.env(g, at, late > 0 ? 0.2 : (e.attack || 0.5), dur - 1.2, 1.2, e.vol);
        o.start(at);
        o.stop(at + dur + 0.3);
        return;
      }
      case 'kick': {
        g = ctx.createGain();
        o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, at);
        o.frequency.exponentialRampToValueAtTime(44, at + 0.12);
        o.connect(g);
        g.connect(bus);
        g.gain.setValueAtTime(e.vol, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
        o.start(at);
        o.stop(at + 0.45);
        return;
      }
      case 'boom': {
        g = ctx.createGain();
        o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(e.red ? 70 : 95, at);
        o.frequency.exponentialRampToValueAtTime(26, at + 1.1);
        o.connect(g);
        g.connect(bus);
        g.connect(send);
        g.gain.setValueAtTime(e.vol, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 2.2);
        o.start(at);
        o.stop(at + 2.3);
        var ng = ctx.createGain();
        flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(e.red ? 1400 : 2400, at);
        flt.frequency.exponentialRampToValueAtTime(120, at + 0.9);
        this.noiseSrc(at, 1.2).connect(flt);
        flt.connect(ng);
        ng.connect(bus);
        ng.connect(send);
        ng.gain.setValueAtTime(e.vol * 0.55, at);
        ng.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
        return;
      }
      case 'crack': {
        g = ctx.createGain();
        flt = ctx.createBiquadFilter();
        flt.type = 'highpass';
        flt.frequency.value = 2500;
        this.noiseSrc(at, 0.3).connect(flt);
        flt.connect(g);
        g.connect(bus);
        g.connect(send);
        g.gain.setValueAtTime(e.vol, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
        return;
      }
      case 'tick': {
        g = ctx.createGain();
        flt = ctx.createBiquadFilter();
        flt.type = 'highpass';
        flt.frequency.value = 7000;
        this.noiseSrc(at, 0.06).connect(flt);
        flt.connect(g);
        g.connect(bus);
        g.gain.setValueAtTime(e.vol, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        return;
      }
      case 'stamp': {
        this.voiceOf({ type: 'kick', vol: e.vol }, at, 0);
        g = ctx.createGain();
        flt = ctx.createBiquadFilter();
        flt.type = 'bandpass';
        flt.frequency.value = 1300;
        flt.Q.value = 1.4;
        this.noiseSrc(at, 0.12).connect(flt);
        flt.connect(g);
        g.connect(bus);
        g.connect(send);
        g.gain.setValueAtTime(e.vol * 0.6, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
        return;
      }
      case 'pluck': {
        g = ctx.createGain();
        g.connect(bus);
        g.connect(send);
        var decay = e.long ? 1.4 : 0.42;
        g.gain.setValueAtTime(e.vol, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
        [[1, 'triangle', 1], [2, 'sine', 0.35]].forEach(function (p) {
          var os = ctx.createOscillator();
          var pg = ctx.createGain();
          os.type = p[1];
          os.frequency.value = e.freq * p[0];
          pg.gain.value = p[2];
          os.connect(pg);
          pg.connect(g);
          os.start(at);
          os.stop(at + decay + 0.05);
        });
        return;
      }
      case 'chime': {
        [[1, 1], [2.76, 0.32], [5.4, 0.12]].forEach(function (p) {
          var os = ctx.createOscillator();
          var cg = ctx.createGain();
          os.type = 'sine';
          os.frequency.value = e.freq * p[0];
          cg.gain.setValueAtTime(e.vol * p[1], at);
          cg.gain.exponentialRampToValueAtTime(0.0001, at + 1.8 / p[0] + 0.3);
          os.connect(cg);
          cg.connect(bus);
          cg.connect(send);
          os.start(at);
          os.stop(at + 2.2);
        });
        return;
      }
      case 'shimmer': {
        e.notes.forEach(function (fr, n) {
          for (k = 0; k < 2; k++) {
            var os = ctx.createOscillator();
            var sg = ctx.createGain();
            os.type = 'sine';
            os.frequency.value = fr;
            os.detune.value = k ? 6 : -6;
            var st = at + n * 0.035;
            sg.gain.setValueAtTime(0.0001, st);
            sg.gain.linearRampToValueAtTime(e.vol, st + 0.02);
            sg.gain.exponentialRampToValueAtTime(0.0001, st + 3.2);
            os.connect(sg);
            sg.connect(bus);
            sg.connect(send);
            os.start(st);
            os.stop(st + 3.3);
          }
        });
        return;
      }
      case 'riser': {
        dur = e.dur / 1000 - late;
        if (dur <= 0.1) return;
        g = ctx.createGain();
        flt = ctx.createBiquadFilter();
        flt.type = 'bandpass';
        flt.Q.value = 2.2;
        flt.frequency.setValueAtTime(300, at);
        flt.frequency.exponentialRampToValueAtTime(7000, at + dur);
        this.noiseSrc(at, dur).connect(flt);
        flt.connect(g);
        g.connect(bus);
        g.connect(send);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(e.vol, at + dur * 0.95);
        g.gain.linearRampToValueAtTime(0.0001, at + dur);
        return;
      }
      case 'whoosh': {
        g = ctx.createGain();
        flt = ctx.createBiquadFilter();
        flt.type = 'bandpass';
        flt.Q.value = 1.6;
        flt.frequency.setValueAtTime(500, at);
        flt.frequency.exponentialRampToValueAtTime(3200, at + 0.35);
        flt.frequency.exponentialRampToValueAtTime(600, at + 0.8);
        this.noiseSrc(at, 0.85).connect(flt);
        flt.connect(g);
        g.connect(bus);
        g.connect(send);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(e.vol, at + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
        return;
      }
    }
    void self;
  };

  window.PitchSound = {
    supported: !!AC,
    create: function (plan, opts) { return new Sound(plan, opts); },
    renderWav: function (plan) { return new Sound(plan, {}).render().then(wav); }
  };
})();
