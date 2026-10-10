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
    // The published page already holds the photograph, with lighter versions for small screens.
    // Only a different photograph replaces it.
    var photo = $('contactPhoto');
    if (data.photo && photo.getAttribute('src') !== data.photo) {
      photo.removeAttribute('srcset');
      photo.removeAttribute('sizes');
      photo.src = data.photo;
    }
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

  // The submit button says what it will do: book an assessment when the box is ticked
  var SEND_LABEL = 'Send message';
  var BOOK_LABEL = 'Book a Readiness Assessment';
  function wantsAssessment() { var box = $('cf-screening'); return !!(box && box.checked); }
  function submitLabel() { return wantsAssessment() ? BOOK_LABEL : SEND_LABEL; }
  function showSubmitLabel() { var b = $('contactSubmit'); if (b && !b.disabled) b.textContent = submitLabel(); }

  // "Book a Readiness Assessment" links here with #screening: tick the box for the visitor.
  // The self-test adds its answers after it (#screening&selftest=…, or #selftest=… on its own).
  function prefill() {
    var hash = location.hash;
    var ticked = /^#screening(&|$)/.test(hash);
    var m = hash.match(/(?:^#|&)selftest=(.+)$/);
    if (!ticked && !m) return;
    if (ticked) {
      var box = $('cf-screening');
      if (box) box.checked = true;
    }
    if (m) {
      try {
        $('cf-message').value = decodeURIComponent(m[1]).slice(0, 4000);
        $('prefillNote').hidden = false;
      } catch (e) { /* a broken address is simply ignored */ }
    }
    history.replaceState(null, '', location.pathname);
    if (ticked && !m) {
      var heading = $('formHeading');
      if (heading) heading.scrollIntoView();          // on a phone the form sits below the contact card
    }
  }

  function encode(form) {
    var pairs = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'submit') return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      pairs.push(encodeURIComponent(el.name) + '=' + encodeURIComponent(el.value));
    });
    return pairs.join('&');
  }

  function wire() {
    var form = $('contactForm');
    if (!form) return;
    var button = $('contactSubmit');
    var error = $('contactError');
    var box = $('cf-screening');
    if (box) box.addEventListener('change', showSubmitLabel);
    showSubmitLabel();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // The subject line of the email Nils receives says when an assessment is asked for
      if (form.elements.subject) {
        form.elements.subject.value = wantsAssessment() ? 'Readiness Assessment request from attolloogroup.com' : 'Message from attolloogroup.com';
      }
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
          button.textContent = submitLabel();
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
