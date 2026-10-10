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
// It also writes each photograph a page uses in lighter versions (part 4) and adds the date each
// page last changed to the sitemap (part 5). Both are extras: if the image library is missing or
// the history of the repository is not there, the pages are published without them.
//
// Usage: node scripts/prerender.mjs [output folder, default _site]

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || '_site');
const SKIP = new Set(['.git', '.github', 'node_modules', 'scripts', 'netlify', 'netlify.toml', 'package.json', 'package-lock.json', 'README.md', '.gitignore', path.basename(OUT)]);

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

// The figures on the home page (the timeline and "Who has to say yes?"), with the same code as the browser
function loadFigures() {
  const window = {};
  vm.runInNewContext(read('js/figures.js'), { window, console });
  if (!window.AttollooFigures || typeof window.AttollooFigures.timelineHtml !== 'function') {
    throw new Error('js/figures.js did not provide the functions the prerender needs');
  }
  return window.AttollooFigures;
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
const figures = attempt('home page figures', loadFigures);
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

    [html, ok] = swap(html, /(<h1 id="heroTitle">)[\s\S]*?(<\/h1>)/, (m, a, b) =>
      a + (page === 'home' && engine.heroTitleHtml ? engine.heroTitleHtml(data.title) : esc(String(data.title || '').trim())) + b);
    // Home: the drawing of the path from product to market, under the headline
    if (engine.heroPathHtml) {
      let drawn;
      [html, drawn] = swap(html, /(<div class="hero-path-slot" data-hero-path>)(<\/div>)/, (m, a, b) => a + engine.heroPathHtml(data) + b);
      if (drawn) did.push('hero path');
    }
    [html] = swap(html, /(<p class="hero-sub" id="heroSubtitle">)[\s\S]*?(<\/p>)/, (m, a, b) => a + esc(String(data.subtitle || '').trim()) + b);

    const img = engine.heroImage(data);
    if (img) {
      [html] = swap(html, /<section class="hero" id="hero"/, (m) => m + ' style="--hero-img:' + esc(engine.heroImageCss(img)) + '"');
      [html] = swap(html, /<\/head>/, '  <link rel="preload" as="image" href="' + esc(img) + '" />\n</head>');
    }

    let diagrams = 0;
    let sections = engine.pageHtml ? engine.pageHtml(data) : engine.sectionsHtml(engine.sectionsOf(data));
    // The timeline takes the place of the picture in one section of one page (set in timeline.json).
    // The browser brings "today" up to date.
    if (figures) {
      attempt(file + ' timeline', () => {
        const tl = readJson('data/timeline.json');
        if ((tl.page || 'home') !== page) return;
        const withIt = figures.withTimeline(sections, tl.section, figures.timelineHtml(tl, new Date()));
        if (withIt !== sections) { sections = withIt; did.push('timeline'); }
      });
    }
    sections = sections
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

  // Home: "Who has to say yes?" as plain text. The browser turns it into the figure.
  if (page === 'home' && figures) {
    attempt(file + ' gates', () => {
      const gates = readJson('data/gates.json');
      [html, ok] = swap(html, /(<div class="wrap gates" data-gates>)(<\/div>)/, (m, a, b) => a + figures.gatesHtml(gates) + b);
      if (ok) did.push('gates');
    });
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

  // Contact: the photograph chosen in the CMS (the browser would otherwise swap it in after loading)
  if (page === 'contact' && engine) {
    attempt(file + ' photo', () => {
      const photo = String(readJson('data/contact.json').photo || '').trim();
      if (photo) [html] = swap(html, /(<img class="contact-photo" id="contactPhoto" src=")[^"]*(")/, (m, a, b) => a + engine.esc(photo) + b);
    });
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

// ---------- 4. Lighter pictures ----------
// The photographs are uploaded as JPEG in one size, large enough for the widest screen. Here
// every photograph a page uses is also written as WebP in a few widths, and the page is told to
// let the browser pick the one that fits the screen. The original stays in the page as the
// fallback, so a picture that cannot be converted is simply shown as before.
const SIZED = '/images/sized/';
const PHOTO = { widths: [480, 720, 960], sizes: '(max-width: 760px) 80vw, (max-width: 1200px) 38vw, 440px' };
// The hero picture lies under a dark blue wash, so it can be compressed harder
const HERO = [
  { width: 1000, media: '(max-width: 700px)' },
  { width: 1600, media: '(min-width: 701px) and (max-width: 1499px)' },
  { width: 2000, media: '(min-width: 1500px)' }
];
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'attolloo-sized');   // kept between builds on Netlify

const sharp = await import('sharp').then((m) => m.default, () => null);
const sized = new Map();                                       // "source|width|quality" -> address, or null

function photoFile(src) {
  const file = path.join(ROOT, decodeURIComponent(src.split('?')[0]));
  return /^\/images\/[^?#]+\.(jpe?g|png)$/i.test(src) && file.startsWith(ROOT + path.sep) && fs.existsSync(file) ? file : null;
}

const widthOf = new Map();
async function naturalWidth(src) {
  if (widthOf.has(src)) return widthOf.get(src);
  let w = 0;
  try {
    const file = photoFile(src);
    if (file) {
      const meta = await sharp(file).metadata();
      w = ((meta.orientation || 1) >= 5 ? meta.height : meta.width) || 0;   // a phone photograph can be stored on its side
    }
  } catch (err) {
    notes.push('picture ' + src + ': ' + err.message);
  }
  widthOf.set(src, w);
  return w;
}

async function lighter(src, width, quality) {
  const key = src + '|' + width + '|' + quality;
  if (sized.has(key)) return sized.get(key);
  let result = null;
  try {
    const file = photoFile(src);
    const natural = file ? await naturalWidth(src) : 0;
    if (natural) {
      const original = fs.readFileSync(file);
      const w = Math.min(width, natural);
      const stem = src.replace(/^\/images\//, '').replace(/\.[a-z]+$/i, '').replace(/[^a-z0-9]+/gi, '-');
      const stamp = crypto.createHash('sha1').update(original).update('|' + w + '|' + quality).digest('hex').slice(0, 8);
      const name = stem + '-' + w + '-' + stamp + '.webp';
      const kept = path.join(CACHE, name);
      if (!fs.existsSync(kept)) {
        const made = await sharp(original).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality, effort: 5 }).toBuffer();
        fs.mkdirSync(CACHE, { recursive: true });
        fs.writeFileSync(kept, made);
      }
      fs.mkdirSync(path.join(OUT, SIZED), { recursive: true });
      fs.copyFileSync(kept, path.join(OUT, SIZED, name));
      result = { url: SIZED + name, width: w };
    }
  } catch (err) {
    notes.push('picture ' + src + ': ' + err.message);
  }
  sized.set(key, result);
  return result;
}

// Sharper compression for the large versions: they are shown on dense screens, where it does not show
const photoQuality = (width) => (width > 720 ? 62 : 72);

async function lightenPage(file) {
  const source = fs.readFileSync(path.join(OUT, file), 'utf8');
  if (!/<body[^>]*\bdata-page="/.test(source)) return null;
  let html = source;
  let count = 0;

  // The hero: one version for each of three screen widths, in place of the single original
  const hero = html.match(/(<section class="hero" id="hero"[^>]*?) style="--hero-img:url\(&quot;([^"&]+)&quot;\)"/);
  if (hero) {
    const src = hero[2];
    const made = [];
    for (const h of HERO) made.push(await lighter(src, h.width, 60));
    if (made.every(Boolean)) {
      const rule = (m) => '#hero{--hero-img:url("' + m.url + '")}';
      const css = rule(made[1]) + HERO.map((h, i) => '@media ' + h.media + '{' + rule(made[i]) + '}').join('');
      const preload = HERO.map((h, i) => '  <link rel="preload" as="image" type="image/webp" href="' + made[i].url + '" media="' + h.media + '" />\n').join('');
      const old = '  <link rel="preload" as="image" href="' + src + '" />\n';
      if (html.includes(old)) {
        html = html.replace(old, preload + '  <style>' + css + '</style>\n').replace(hero[0], hero[1]);
        count++;
      }
    }
  }

  // Photographs in the text, and the one on the contact page. The original is offered as the
  // largest version when it is of ordinary size; a very large upload gets a 1200-pixel version.
  const found = [];
  html.replace(/<img\b[^>]*\bsrc="(\/images\/[^"]+\.(?:jpe?g|png))"[^>]*>/gi, (tag, src, at) => { found.push({ tag, src, at }); return tag; });
  for (const f of found.reverse()) {
    if (/\ssrcset=/.test(f.tag)) continue;
    const natural = await naturalWidth(f.src);
    if (!natural || natural < 600) continue;                                    // logos and other small pictures
    const list = [];
    for (const w of PHOTO.widths.filter((w) => w < natural)) {
      const m = await lighter(f.src, w, photoQuality(w));
      if (m) list.push(m);
    }
    if (!list.length) continue;
    if (natural <= 1400) list.push({ url: f.src, width: natural });
    else { const m = await lighter(f.src, 1200, photoQuality(1200)); if (m) list.push(m); }
    const srcset = list.map((m) => m.url + ' ' + m.width + 'w').join(', ');
    const tag = f.tag.replace(/^<img\b/i, '<img srcset="' + srcset + '" sizes="' + PHOTO.sizes + '"');
    html = html.slice(0, f.at) + tag + html.slice(f.at + f.tag.length);
    count++;
  }

  if (html !== source) fs.writeFileSync(path.join(OUT, file), html);
  return count;
}

if (sharp) {
  let total = 0;
  for (const file of pages) {
    try { total += (await lightenPage(file)) || 0; } catch (err) { notes.push(file + ' pictures: ' + err.message); }
  }
  console.log('\nprerender: lighter pictures in ' + total + ' places (' + new Set([...sized.values()].filter(Boolean).map((m) => m.url)).size + ' files)');
} else {
  console.log('\nprerender: the image library is not installed, so the pictures are published as they are');
}

// ---------- 5. Sitemap: the date each page last changed ----------
// Taken from the history of the page's text in /data (or of the page itself when it has no text
// file). Left out when the history is not available, so a date is never guessed.
attempt('sitemap dates', () => {
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let shallow;
  try { shallow = git('rev-parse', '--is-shallow-repository'); } catch (err) { return; }
  if (shallow !== 'false') { console.log('prerender: sitemap left without dates (the history of the repository is not here)'); return; }
  const tl = attempt('timeline', () => readJson('data/timeline.json')) || {};
  let dated = 0;
  const xml = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8').replace(/<url><loc>(https:\/\/[^/]+\/([^<]*))<\/loc><\/url>/g, (m, loc, rel) => {
    const file = rel || 'index.html';
    if (!fs.existsSync(path.join(ROOT, file))) return m;
    const page = (read(file).match(/<body[^>]*\bdata-page="([^"]+)"/) || [])[1];
    const texts = [];
    if (engine && engine.DATA[page]) texts.push(engine.DATA[page].replace(/^\//, ''));
    if (page === 'home') texts.push('data/gates.json');
    if (page === 'pitch' || page === 'match') texts.push('data/' + page + '.json');
    if ((tl.page || 'home') === page) texts.push('data/timeline.json');
    const files = texts.filter((t) => fs.existsSync(path.join(ROOT, t)));
    const date = git('log', '-1', '--format=%cs', '--', ...(files.length ? files : [file]));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return m;
    dated++;
    return '<url><loc>' + loc + '</loc><lastmod>' + date + '</lastmod></url>';
  });
  if (dated) { fs.writeFileSync(path.join(OUT, 'sitemap.xml'), xml); console.log('prerender: sitemap with dates for ' + dated + ' pages'); }
});

if (notes.length) {
  console.warn('\nprerender: some parts were left for the browser to fill in:');
  for (const n of notes) console.warn('  - ' + n);
}
console.log('\nprerender: site written to ' + path.relative(ROOT, OUT) + '/');
