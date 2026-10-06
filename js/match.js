// /js/match.js — the "Are we a match?" self-test.
// Questions and result texts come from /data/match.json (editable in the CMS).
// Nothing is stored or sent: the answers only exist in this page until it is closed.
(function () {
  'use strict';

  var esc = window.AttollooSite.esc;
  var renderText = window.AttollooSite.renderText;

  var LEVELS = { 2: 'Documented', 1: 'Partly', 0: 'Not yet' };

  var data = null;
  var answers = [];   // chosen option index per question
  var step = -1;      // -1 = intro, questions.length = result

  var panel, figure;

  function dimQuestions() {
    return data.questions
      .map(function (q, i) { return { q: q, i: i }; })
      .filter(function (x) { return x.q.group === 'dimension'; });
  }

  function chosen(i) {
    var q = data.questions[i];
    return answers[i] == null ? null : q.options[answers[i]];
  }

  /* ---------- Six-sided figure ---------- */

  function drawFigure() {
    var dims = dimQuestions();
    var cx = 180, cy = 150, r = 96;
    var pts = [];
    for (var k = 0; k < 6; k++) {
      var a = (Math.PI / 180) * (60 * k - 90);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    var labelPos = [
      [236, 58, 'start'], [270, 155, 'start'], [236, 252, 'start'],
      [124, 252, 'end'], [90, 155, 'end'], [124, 58, 'end']
    ];
    var summary = [];
    var svg = '';
    dims.slice(0, 6).forEach(function (d, k) {
      var p = pts[k], q = pts[(k + 1) % 6];
      var opt = chosen(d.i);
      var level = opt ? String(opt.score) : '';
      var current = step === d.i;
      svg += '<polygon class="hex-wedge" points="' + cx + ',' + cy + ' ' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ' ' +
        q[0].toFixed(1) + ',' + q[1].toFixed(1) + '"' +
        (level !== '' ? ' data-level="' + level + '"' : '') +
        (current ? ' data-current="true"' : '') + '/>';
      svg += '<text class="hex-label" x="' + labelPos[k][0] + '" y="' + labelPos[k][1] + '" text-anchor="' + labelPos[k][2] + '">' +
        esc(d.q.dimension) + '</text>';
      summary.push(d.q.dimension + ': ' + (opt ? LEVELS[opt.score].toLowerCase() : 'not answered'));
    });

    var caption;
    if (step < 0) caption = 'The six dimensions fill in as you answer.';
    else if (step >= data.questions.length) caption = 'Your answers across the six dimensions.';
    else if (data.questions[step].group === 'fit') caption = 'First, the questions about fit.';
    else caption = 'Now answering: ' + data.questions[step].dimension + '.';

    figure.innerHTML =
      '<svg viewBox="0 0 360 300" role="img" aria-label="' + esc('6Sense profile. ' + summary.join(', ') + '.') + '">' + svg + '</svg>' +
      '<figcaption>' + esc(caption) + '</figcaption>' +
      '<ul class="hex-legend" aria-hidden="true">' +
      '<li><span class="lv2"></span>Documented</li><li><span class="lv1"></span>Partly</li><li><span class="lv0"></span>Not yet</li></ul>';
  }

  /* ---------- Screens ---------- */

  function show(html) {
    panel.innerHTML = html;
    panel.parentNode.setAttribute('data-state', step < 0 ? 'intro' : (step >= data.questions.length ? 'result' : 'question'));
    drawFigure();
    var h = panel.querySelector('h2');
    if (h && step !== -1) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    if (step !== -1) {
      var top = panel.getBoundingClientRect().top;
      if (top < 80 || top > window.innerHeight * 0.6) {
        window.scrollTo({ top: window.scrollY + top - 100 });
      }
    }
  }

  function showIntro() {
    step = -1;
    show(
      '<h2>' + esc(data.intro_heading) + '</h2>' +
      '<div class="prose">' + renderText(data.intro_body) + '</div>' +
      '<div class="match-actions"><button type="button" class="btn btn--primary" data-go="start">' + esc(data.start_label || 'Start the self-test') + '</button></div>' +
      '<p class="match-note">' + esc(data.privacy_note) + '</p>'
    );
  }

  function showQuestion(i) {
    step = i;
    var q = data.questions[i];
    var total = data.questions.length;
    var last = i === total - 1;
    var options = q.options.map(function (o, k) {
      return '<label class="match-option"><input type="radio" name="answer" value="' + k + '"' +
        (answers[i] === k ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>';
    }).join('');
    show(
      '<form novalidate>' +
      '<p class="match-step">Question ' + (i + 1) + ' of ' + total + ': ' + esc(q.group === 'fit' ? 'Fit' : q.dimension) + '</p>' +
      '<fieldset><legend><h2>' + esc(q.question) + '</h2></legend>' +
      (q.help ? '<div class="match-help prose">' + renderText(q.help) + '</div>' : '') +
      '<div class="match-options">' + options + '</div></fieldset>' +
      '<div class="match-actions">' +
      '<button type="submit" class="btn btn--primary"' + (answers[i] == null ? ' disabled' : '') + '>' + (last ? 'See the result' : 'Next') + '</button>' +
      '<button type="button" class="btn btn--quiet" data-go="back">Back</button>' +
      '</div></form>'
    );
  }

  function verdict() {
    var fit = [], dims = [];
    data.questions.forEach(function (q, i) {
      var o = chosen(i);
      (q.group === 'fit' ? fit : dims).push({ q: q, o: o });
    });
    var excluded = fit.filter(function (x) { return x.o.score === 0; });
    var maybes = fit.filter(function (x) { return x.o.score === 1; });
    var zeros = dims.filter(function (x) { return x.o.score === 0; }).length;
    var twos = dims.filter(function (x) { return x.o.score === 2; }).length;
    var decision = dims.filter(function (x) { return /decision/i.test(x.q.dimension); })[0];

    var key;
    if (excluded.length) key = 'excluded';
    else if (decision && decision.o.score === 0) key = 'veto';
    else if (zeros === 0 && twos >= 3 && maybes.length === 0) key = 'strong';
    else if (zeros <= 2) key = 'possible';
    else key = 'not_yet';

    return { key: key, fit: fit, dims: dims, excluded: excluded, maybes: maybes };
  }

  function summary(v, res) {
    var lines = ['Self-test result: ' + res.heading, ''];
    v.fit.forEach(function (x) { lines.push(x.q.dimension + ': ' + x.o.label); });
    lines.push('');
    v.dims.forEach(function (x) { lines.push(x.q.dimension + ' (' + LEVELS[x.o.score] + '): ' + x.o.label); });
    return lines;
  }

  function mailto(v, res) {
    return 'mailto:' + (data.contact_email || '') +
      '?subject=' + encodeURIComponent('Attolloo self-test: ' + res.heading) +
      '&body=' + encodeURIComponent(summary(v, res).concat(['', 'Company:', 'Name:', '']).join('\n'));
  }

  // The answers travel after the # in the address, so they are not sent anywhere until the form is submitted
  function formLink(v, res) {
    return '/contact.html#selftest=' + encodeURIComponent(summary(v, res).join('\n'));
  }

  function showResult() {
    step = data.questions.length;
    var v = verdict();
    var res = data.results[v.key];
    var canTalk = v.key === 'strong' || v.key === 'possible';

    var html = '<p class="match-step">Your result</p>' +
      '<div class="match-verdict" data-verdict="' + v.key + '"><h2>' + esc(res.heading) + '</h2>' +
      '<p>' + esc(res.body) + '</p></div>';

    var reasons = (v.key === 'excluded' ? v.excluded : v.maybes).filter(function (x) { return x.o.note; });
    if (reasons.length && (v.key === 'excluded' || canTalk)) {
      html += '<h3 class="match-subhead">' + (v.key === 'excluded' ? 'Why' : 'Worth raising in the conversation') + '</h3>' +
        '<ul class="match-reasons">' + reasons.map(function (x) { return '<li>' + esc(x.o.note) + '</li>'; }).join('') + '</ul>';
    }

    if (v.key !== 'excluded') {
      html += '<h3 class="match-subhead">Your answers across the six dimensions</h3><ul class="match-results">' +
        v.dims.map(function (x) {
          return '<li data-level="' + x.o.score + '"><span class="dim-cell"><span class="dim">' + esc(x.q.dimension) + '</span>' +
            '<span class="level">' + LEVELS[x.o.score] + '</span></span>' +
            '<span class="answer">' + esc(x.o.label) + '</span></li>';
        }).join('') + '</ul>';
    }

    html += '<div class="match-actions">' +
      (canTalk
        ? '<a class="btn btn--primary" href="' + esc(formLink(v, res)) + '">Send your answers to Nils</a>' +
          '<a class="btn btn--quiet" href="' + esc(mailto(v, res)) + '">Use your own email instead</a>'
        : '<a class="btn btn--primary" href="/startups.html">Read how the 6Sense Filter works</a>') +
      '<button type="button" class="btn btn--quiet" data-go="restart">Start again</button></div>';

    if (canTalk) html += '<p class="match-note">The first button opens the contact form with your answers filled in. Nothing is sent until you press send there.</p>';

    if (data.scoring_note) {
      html += '<details class="match-scoring"><summary>How this is scored</summary>' + renderText(data.scoring_note) + '</details>';
    }
    show(html);
  }

  /* ---------- Events ---------- */

  function onClick(e) {
    var btn = e.target.closest('[data-go]');
    if (!btn) return;
    var go = btn.getAttribute('data-go');
    if (go === 'start') showQuestion(0);
    else if (go === 'back') { if (step <= 0) showIntro(); else showQuestion(step - 1); }
    else if (go === 'restart') { answers = []; showIntro(); window.scrollTo({ top: 0 }); }
  }

  function onChange(e) {
    if (e.target.name !== 'answer') return;
    answers[step] = Number(e.target.value);
    var next = panel.querySelector('button[type="submit"]');
    if (next) next.disabled = false;
    drawFigure();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (answers[step] == null) return;
    if (step >= data.questions.length - 1) showResult();
    else showQuestion(step + 1);
  }

  function start() {
    panel = document.getElementById('matchPanel');
    figure = document.getElementById('matchFigure');
    if (!panel || !figure) return;

    fetch('/data/match.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        data = json;
        var t = document.getElementById('matchTitle');
        var s = document.getElementById('matchSubtitle');
        if (t && data.title) t.textContent = data.title;
        if (s && data.subtitle) s.textContent = data.subtitle;
        panel.addEventListener('click', onClick);
        panel.addEventListener('change', onChange);
        panel.addEventListener('submit', onSubmit);
        showIntro();
      })
      .catch(function (err) {
        console.error('Could not load the self-test', err);
        panel.innerHTML = '<p>The self-test could not be loaded. Please try again in a moment, or email ' +
          '<a href="mailto:nils.johan@attolloogroup.com">nils.johan@attolloogroup.com</a>.</p>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
