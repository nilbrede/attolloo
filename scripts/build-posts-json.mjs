import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import matter from "gray-matter";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(__dirname, "..", "blog", "posts");

function mdToEntry(file) {
  const src = readFileSync(join(POSTS_DIR, file), "utf8");
  const { data } = matter(src);               // YAML front matter
  const slug = file.replace(/\.md$/i, "");
  return {
    title: data.title || slug,
    slug,
    cover: data.cover || "",
    date: (data.date || "").toString().slice(0,10),
    excerpt: data.excerpt || ""
  };
}

const files = readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"));
const entries = files.map(mdToEntry)
  .sort((a,b)=> (b.date||"").localeCompare(a.date||""));

const outPath = join(__dirname, "..", "blog", "posts.json");
writeFileSync(outPath, JSON.stringify(entries, null, 2));
console.log(`Wrote ${entries.length} entries to blog/posts.json`);
