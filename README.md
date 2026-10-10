# attolloo

The website for Attolloo Group, [attolloogroup.com](https://attolloogroup.com).

## How it fits together

- The pages (`index.html`, `about.html` and so on) are shells. The text lives in `data/*.json`
  and is edited in the CMS at `/admin`.
- `js/site.js` turns that text into the page. `js/menu-init.js` holds the menu, `footer.html` the footer.
- `method.html` is the overview of the method: the four frameworks as one path, with a link to each.
  The four framework pages open with three lines, "In short" (the `in_short` field in their data).
- There are two figures, built by `js/figures.js`: the timeline of rules (`data/timeline.json`), which
  sits in one section of one page (set in that file; now the 6Sense page), and "Who has to say yes?"
  (`data/gates.json`) on the home page. Both are edited in the CMS under "Figurer".
  Where "today" sits on the timeline is worked out from the date of the visit.
- When Netlify publishes the site it runs `node scripts/prerender.mjs` (see `netlify.toml`).
  The script copies the site to `_site/` and writes the text, the menu and the footer into each
  page there, so the content is in the page itself and can be read without scripts (search
  engines, link previews, AI assistants). Netlify publishes `_site/`. The files in this
  repository are not changed, and `_site/` is never committed.
- Opened straight from the repository, without that step, the pages fill themselves in
  in the browser as before.
- The same script makes the photographs lighter. Every photograph a page uses is also written as
  WebP in a few widths (to `_site/images/sized/`), and the page lets the browser pick the one that
  fits the screen. The original stays as the largest version and as the fallback. This needs the
  `sharp` package; without it the pictures are published as they are. A photograph uploaded in the
  CMS is handled the same way the next time the site is published, so nothing has to be resized by hand.
- It also writes into the sitemap the date each page's text last changed, taken from the history
  of the repository.
- What search engines show for a page is in the page's own file: `<title>`, the description and
  the block of structured data (`application/ld+json`) in its `<head>`. The title and description
  are repeated in the `og:` lines and in the structured data, and the three should say the same.

If the script cannot prepare a page, that page is published as its shell and still works
in the browser. The publish log on Netlify says which pages were prepared.

## The visit count

The site counts its own visits. There is no outside service, no cookie, and nothing that can tell
one visitor from another.

- `js/count.js` runs on every page. It sends the page, the action and the name of the site the
  visitor came from to `/api/count`. It sends nothing for browsers that ask not to be tracked,
  or where the count has been switched off by opening `/?nocount` (on again with `/?count`).
- `netlify/functions/count.mjs` is `/api/count`. It stores one small entry per visit in Netlify
  Blobs, which comes with the Netlify account. Visits to preview versions of the site are kept
  apart from visits to attolloogroup.com.
- The numbers are at `/admin/stats.html`, behind the same login as the CMS.
- What is counted is described for visitors in `data/privacy.json` ("Counting Visits"). If the
  count changes, change that text first.

`package.json` exists only for this: the function needs `@netlify/blobs`. The pages themselves
need nothing installed.
