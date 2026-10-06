// /js/contact.js — the contact page.
// The person card is filled from /data/contact.json (editable in the CMS).
// The form is sent to Netlify Forms; if that fails, the visitor gets an email link with the message kept.
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function setText(id, value) { var el = $(id); if (el && value) el.textContent = String(value).trim(); }

  var email = 'nils.johan@attolloogroup.com';

  function fill(data) {
    setText('contactName', data.name);
    setText('contactRole', data.role);
    setText('contactLocation', data.location);
    setText('formHeading', data.form_heading);
    setText('formIntro', data.form_intro);
    setText('privacyNote', data.privacy_note);
    setText('successHeading', data.success_heading);
    setText('successBody', data.success_body);
    if (data.photo) { $('contactPhoto').src = data.photo; }
    if (data.name) { $('contactPhoto').alt = data.name; }
    if (data.email) {
      email = String(data.email).trim();
      $('contactEmail').href = 'mailto:' + email;
      $('contactEmail').textContent = email;
    }
    var li = $('contactLinkedin');
    if (/^https:\/\/([a-z]+\.)?linkedin\.com\//.test(String(data.linkedin || ''))) {
      li.href = data.linkedin;
      if (data.name) li.textContent = data.name + ' on LinkedIn';
    } else if ('linkedin' in data) {
      $('contactLinkedinRow').hidden = true;         // field emptied in the CMS
    }
  }

  // "Send with the contact form" on the self-test passes the answers in the address, after the #
  function prefill() {
    var m = location.hash.match(/^#selftest=(.+)$/);
    if (!m) return;
    try {
      $('cf-message').value = decodeURIComponent(m[1]).slice(0, 4000);
      $('prefillNote').hidden = false;
      history.replaceState(null, '', location.pathname);
    } catch (e) { /* a broken address is simply ignored */ }
  }

  function encode(form) {
    var pairs = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'submit') return;
      pairs.push(encodeURIComponent(el.name) + '=' + encodeURIComponent(el.value));
    });
    return pairs.join('&');
  }

  function wire() {
    var form = $('contactForm');
    if (!form) return;
    var button = $('contactSubmit');
    var error = $('contactError');
    var label = button.textContent;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      error.hidden = true;
      button.disabled = true;
      button.textContent = 'Sending…';

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(form)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          form.hidden = true;
          $('prefillNote').hidden = true;
          var done = $('contactSuccess');
          done.hidden = false;
          done.focus();
        })
        .catch(function (err) {
          console.error('Could not send the contact form', err);
          button.disabled = false;
          button.textContent = label;
          var body = $('cf-message').value + '\n\n' + $('cf-name').value + ($('cf-company').value ? ', ' + $('cf-company').value : '');
          error.textContent = 'The message could not be sent from this page. ';
          var a = document.createElement('a');
          a.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Message from attolloogroup.com') + '&body=' + encodeURIComponent(body);
          a.textContent = 'Send it as an email instead';
          error.appendChild(a);
          error.appendChild(document.createTextNode('. Your text is kept.'));
          error.hidden = false;
        });
    });
  }

  function init() {
    prefill();
    wire();
    fetch('/data/contact.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(fill)
      .catch(function (err) { console.error('Could not load contact details', err); });   // the page already holds defaults
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
