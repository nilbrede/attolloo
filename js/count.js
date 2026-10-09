// /js/count.js — counts visits for /api/count (see /netlify/functions/count.mjs).
// It sends the page, the action and the name of the site the visitor came from. Nothing else:
// no cookie, no identifier, nothing that can tell one visitor from another.
//
// Not counted: browsers that ask not to be tracked, and browsers where the count has been
// switched off by opening /?nocount (switched on again with /?count).
(function () {
  'use strict';

  var KEY = 'attolloo-nocount';
  var page = (document.body && document.body.dataset.page) || 'other';

  function stored() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function note(text) {
    var el = document.createElement('p');
    el.setAttribute('role', 'status');
    el.textContent = text;
    el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99;margin:0;padding:12px 18px;' +
      'border-radius:6px;background:#002448;color:#fff;font:600 15px/1.3 "Schibsted Grotesk",system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,36,72,.35)';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 6000);
  }

  // /?nocount switches the count off in this browser, /?count switches it on again
  if (/[?&]nocount\b/.test(location.search)) {
    try { localStorage.setItem(KEY, '1'); note('Counting is switched off in this browser.'); } catch (e) { /* no storage: nothing to switch */ }
  } else if (/[?&]count\b/.test(location.search)) {
    try { localStorage.removeItem(KEY); note('Counting is switched on again in this browser.'); } catch (e) { /* nothing stored */ }
  }

  var off = stored() ||
    navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true ||
    /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]counttest\b/.test(location.search);

  var sent = {};
  function count(event, detail, once) {
    if (off) return;
    var id = event + ':' + (detail || '');
    if (once !== false && sent[id]) return;
    sent[id] = true;
    var from = '';
    try {
      var ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
      if (ref && ref !== location.hostname.replace(/^www\./, '')) from = ref;
    } catch (e) { /* no referrer */ }
    var body = JSON.stringify({ p: page, e: event, d: detail || '', r: from });
    try {
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/count', body))) {
        fetch('/api/count', { method: 'POST', body: body, keepalive: true }).catch(function () {});
      }
    } catch (e) { /* counting must never get in the way of the page */ }
  }

  count('view');

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('a[href$="#screening"], a[href*="#screening&"]')) count('book-click');
    if (t.closest('.pitch-start, a[data-pitch-play]')) count('pitch-start');
    if (t.closest('[data-go="start"]')) count('selftest-start');
    if (t.closest('.gates-gap, .gates-choice, .gates [data-next]')) count('gates-used');
  });

  // Things that happen without a click on a marked element: the film ending, a self-test result, a sent message
  function look() {
    if (document.querySelector('.pitch-stage.is-started')) count('pitch-start');
    if (document.querySelector('.pitch-stage.is-ended')) count('pitch-end');
    var verdict = document.querySelector('.match-verdict[data-verdict]');
    if (verdict) count('selftest-result', verdict.getAttribute('data-verdict'));
    var done = document.getElementById('contactSuccess');
    if (done && !done.hidden) {
      var box = document.getElementById('cf-screening');
      count('message-sent', box && box.checked ? 'assessment' : 'message');
    }
  }
  if (!off && 'MutationObserver' in window) {
    look();
    var waiting = false;                // the film changes the page many times a second: look twice a second at most
    new MutationObserver(function () {
      if (waiting) return;
      waiting = true;
      setTimeout(function () { waiting = false; look(); }, 500);
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  }
})();
