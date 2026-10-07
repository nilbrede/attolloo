// scripts/prerender.mjs — run by Netlify every time the site is published (see /netlify.toml).
//
// The pages in this repository are shells: the text lives in /data/*.json (written in the CMS)
// and /js/site.js puts it on the page in the browser. That leaves the pages empty for anything
// that does not run scripts: search engines, link previews, AI assistants, screen readers on a
// slow line. This script copies the site to /_site and writes the finished text, the menu and
// the footer into each page there. Netlify publishes /_site. Nothing in the repository changes.
//
// It uses the same code as the browser (/js/site.js, and the menu in /js/menu-init.js), so the
// published page and the page built in the browser are the same. If one page cannot be prepared
// it is published as the shell it was, and the browser fills it in as before.
//
// No dependencies. Usage: node scripts/prerender.mjs [output folder, default _site]

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || '_site');
const SKIP = new Set(['.git', '.github', 'node_modules', 'scripts', 'netlify.toml', 'README.md', '.gitignore', path.basename(OUT)]);

if (OUT === ROOT || !OUT.startsWith(ROOT + path.sep)) {
  console.error('prerender: the output folder must be a folder inside the site.');
  process.exit(1);
}

// ---------- 1. Copy the site ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}

// ---------- 2. Load the page engine as the browser would ----------
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

function loadEngine() {
  const window = {};
  const document = {
    readyState: 'complete',
    body: { dataset: {}, hasAttribute: () => false },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  };
  vm.runInNewContext(read('js/site.js'), { window, document, console, location: { hash: '', search: '' } });
  if (!window.AttollooSite || typeof window.AttollooSite.sectionsHtml !== 'function') {
    throw new Error('js/site.js did not provide the functions the prerender needs');
  }
  return window.AttollooSite;
}

function loadHeader() {
  const m = read('js/menu-init.js').match(/const HEADER_HTML = `([\s\S]*?)`;/);
  if (!m || /\$\{/.test(m[1])) throw new Error('could not read HEADER_HTML from js/menu-init.js');
  return m[1].replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n/g, '\n').trim()
    .replace('<header class="site-header">', '<header class="site-header" data-prerendered>');
}

// A diagram is written into the page only when it is plain drawing: no scripts,
// no embedded HTML, no event attributes. Anything else is left for the browser,
// which cleans it before showing it.
function inlineSvg(src) {
  const file = path.join(ROOT, decodeURIComponent(src.split('?')[0]));
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return null;
  let svg = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  svg = svg.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>$/i.test(svg)) return null;
  if (/<script|<foreignObject|<iframe|<object|<embed|\son[a-z]+\s*=|javascript:|<!ENTITY/i.test(svg)) return null;
  return svg;
}

// Replace the first match and say whether there was one.
function swap(html, pattern, replacement) {
  let done = false;
  const out = html.replace(pattern, (...args) => { done = true; return typeof replacement === 'function' ? replacement(...args) : replacement; });
  return [out, done];
}

// ---------- 3. Prepare each page ----------
let engine = null;
let header = null;
let footer = null;
const notes = [];
const attempt = (label, fn) => { try { return fn(); } catch (err) { notes.push(label + ': ' + err.message); return null; } };

engine = attempt('page engine', loadEngine);
header = attempt('menu', loadHeader);
footer = attempt('footer', () => read('footer.html').trim()
  .replace('<span id="year"></span>', '<span id="year">' + new Date().getFullYear() + '</span>'));

const NOSCRIPT_CSS = '  <noscript><link rel="stylesheet" href="/css/noscript.css" /></noscript>\n';

function preparePage(file) {
  const source = fs.readFileSync(path.join(OUT, file), 'utf8');
  const bodyTag = source.match(/<body[^>]*\bdata-page="([^"]+)"[^>]*>/);
  if (!bodyTag) return null;                                   // not a page (footer.html, header.html)
  const page = bodyTag[1];
  let html = source;
  let ok;
  const did = [];

  // The text of the page
  const dataUrl = engine && engine.DATA[page];
  if (dataUrl) {
    const data = readJson(dataUrl.replace(/^\//, ''));
    const esc = engine.esc;

    [html, ok] = swap(html, /(<h1 id="heroTitle">)[\s\S]*?(<\/h1>)/, (m, a, b) => a + esc(String(data.title || '').trim()) + b);
    [html] = swap(html, /(<p class="hero-sub" id="heroSubtitle">)[\s\S]*?(<\/p>)/, (m, a, b) => a + esc(String(data.subtitle || '').trim()) + b);

    const img = engine.heroImage(data);
    if (img) {
      [html] = swap(html, /<section class="hero" id="hero"/, (m) => m + ' style="--hero-img:' + esc(engine.heroImageCss(img)) + '"');
      [html] = swap(html, /<\/head>/, '  <link rel="preload" as="image" href="' + esc(img) + '" />\n</head>');
    }

    let diagrams = 0;
    const sections = engine.sectionsHtml(engine.sectionsOf(data))
      .replace(/<div class="diagram" data-svg="([^"]*)"><\/div>/g, (slot, src) => {
        const svg = attempt(file + ' diagram', () => inlineSvg(src.replace(/&amp;/g, '&')));
        if (!svg) return slot;
        diagrams++;
        return '<div class="diagram">' + svg + '</div>';
      });
    let filled;
    [html, filled] = swap(html, /(<main id="sections" class="story")>\s*(<\/main>)/, (m, a, b) => a + '>' + sections + b);
    if (ok || filled) {
      html = html.replace(bodyTag[0], bodyTag[0].replace(/>$/, ' data-prerendered>'));
      did.push('text' + (diagrams ? ' + ' + diagrams + ' diagram' + (diagrams > 1 ? 's' : '') : ''));
    }
  }

  // The pitch: the film is built in the browser. The words are written here for readers
  // without scripts (inside <noscript>, so they do not flash by before the film appears).
  if (page === 'pitch') {
    const data = readJson('data/pitch.json');
    const esc = engine ? engine.esc : null;
    if (esc && Array.isArray(data.scenes)) {
      const lines = data.scenes.map((s) => {
        const items = (s.items || []).length ? ' ' + s.items.map(esc).join('. ') + '.' : '';
        return '<li>' + esc(s.headline) + items + (s.detail ? ' ' + esc(s.detail) : '') + '</li>';
      }).join('');
      const cta = data.cta_url ? '<p><a class="btn btn--primary" href="' + esc(data.cta_url) + '">' + esc(data.cta_label || 'Are we a match?') + '</a></p>' : '';
      [html, ok] = swap(html, /(<div class="pitch-band-inner" data-pitch>)(<\/div>)/, (m, a, b) =>
        a + '<noscript><div class="pitch-static"><h2>' + esc(data.poster_title || 'The pitch in one minute') + '</h2><ol>' + lines + '</ol>' + cta + '</div></noscript>' + b);
      if (ok) did.push('pitch text');
    }
  }

  // The self-test: title and introduction (the questions need the browser)
  if (page === 'match' && engine) {
    const data = readJson('data/match.json');
    if (data.title) [html] = swap(html, /(<h1 id="matchTitle">)[\s\S]*?(<\/h1>)/, (m, a, b) => a + engine.esc(String(data.title).trim()) + b);
    if (data.subtitle) {
      [html, ok] = swap(html, /(<p id="matchSubtitle">)[\s\S]*?(<\/p>)/, (m, a, b) => a + engine.esc(String(data.subtitle).trim()) + b);
      if (ok) did.push('self-test intro');
    }
  }

  // Menu, self-test invitation and footer
  if (header && /\/js\/menu-init\.js/.test(html) && !/<header class="site-header"/.test(html)) {
    [html, ok] = swap(html, /(<body[^>]*>)/, (m, a) => a + '\n\n  ' + header.replace(/\n/g, '\n  ') + '\n');
    if (ok) {
      did.push('menu');
      [html] = swap(html, /<\/head>/, NOSCRIPT_CSS + '</head>');
    }
  }
  if (footer) {
    const band = engine && engine.wantsMatchBand(page) ? engine.matchBandHtml() + '\n\n  ' : '';
    [html, ok] = swap(html, /<div id="footer"><\/div>/, band + '<div id="footer">' + footer + '</div>');
    if (ok) did.push('footer');
  }

  if (html !== source) fs.writeFileSync(path.join(OUT, file), html);
  return did;
}

const pages = fs.readdirSync(OUT).filter((f) => f.endsWith('.html')).sort();
for (const file of pages) {
  const did = attempt(file, () => preparePage(file));
  if (did === null) continue;
  console.log('prerender: ' + file.padEnd(20) + (did.length ? did.join(', ') : 'left as it is'));
}

if (notes.length) {
  console.warn('\nprerender: some parts were left for the browser to fill in:');
  for (const n of notes) console.warn('  - ' + n);
}
console.log('\nprerender: site written to ' + path.relative(ROOT, OUT) + '/');
