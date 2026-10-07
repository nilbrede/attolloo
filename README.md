# attolloo

The website for Attolloo Group, [attolloogroup.com](https://attolloogroup.com).

## How it fits together

- The pages (`index.html`, `about.html` and so on) are shells. The text lives in `data/*.json`
  and is edited in the CMS at `/admin`.
- `js/site.js` turns that text into the page. `js/menu-init.js` holds the menu, `footer.html` the footer.
- When Netlify publishes the site it runs `node scripts/prerender.mjs` (see `netlify.toml`).
  The script copies the site to `_site/` and writes the text, the menu and the footer into each
  page there, so the content is in the page itself and can be read without scripts (search
  engines, link previews, AI assistants). Netlify publishes `_site/`. The files in this
  repository are not changed, and `_site/` is never committed.
- Opened straight from the repository, without that step, the pages fill themselves in
  in the browser as before.

If the script cannot prepare a page, that page is published as its shell and still works
in the browser. The publish log on Netlify says which pages were prepared.
