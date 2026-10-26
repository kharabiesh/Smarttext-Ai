// Builds the Arabic PDF guides from docs/manual/*.ar.html with headless Chromium:
//   manual.ar.html  -> USER_MANUAL_AR.pdf
//   install.ar.html -> INSTALL_GUIDE_AR.pdf
// Two passes: the first prints invisible markers to find each section's page, the second
// prints the final document with those page numbers in the table of contents.
//   node scripts/manual/build-manual.mjs [manual|install]   (default: both)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "../pw.mjs";

const root = resolve(import.meta.dirname, "../..");
const manualDir = join(root, "docs/manual");
const DOCS = { manual: ["manual.ar.html", "USER_MANUAL_AR.pdf"], install: ["install.ar.html", "INSTALL_GUIDE_AR.pdf"] };
const which = process.argv[2] ? [process.argv[2]] : Object.keys(DOCS);
if (which.some((w) => !DOCS[w])) throw new Error(`Unknown document. Use one of: ${Object.keys(DOCS).join(", ")}`);
const work = mkdtempSync(join(tmpdir(), "smarttext-manual-"));

const date = new Intl.DateTimeFormat("ar-u-nu-latn", { month: "long", year: "numeric" }).format(new Date());

/** Collects chapters (sections with data-ch) and their h3 headings, in document order. */
function outline(html) {
  const entries = [];
  const sectionRe = /<section class="chapter" data-ch="([^"]+)" data-title="([^"]+)">([\s\S]*?)<\/section>/g;
  for (const m of html.matchAll(sectionRe)) {
    entries.push({ level: 1, num: m[1], title: m[2] });
    for (const h of m[3].matchAll(/<h3>([\s\S]*?)<\/h3>/g)) entries.push({ level: 2, title: h[1].replace(/<[^>]+>/g, "") });
  }
  return entries.map((e, i) => ({ ...e, key: `QQMK${String(i).padStart(3, "0")}QQ` }));
}

/** Inserts a marker after each chapter's opening tag and inside each h3. */
function withMarkers(html, entries) {
  let i = 0;
  return html.replace(/<section class="chapter"[^>]*>|<h3>/g, (tag) => {
    const e = entries[i++];
    return `${tag}<span class="marker">${e.key}</span>`;
  });
}

function toc(entries, pages) {
  return entries
    .map((e) => {
      const pg = pages?.[e.key] ?? "00";
      if (e.level === 2) return `<li class="sub"><span class="fill">${e.title}</span><span class="pg">${pg}</span></li>`;
      const label = e.num === "✓" ? "ملحق" : `الفصل ${e.num}`;
      return `<li><span class="num">${label}</span><span class="fill">${e.title}</span><span class="pg">${pg}</span></li>`;
    })
    .join("\n");
}

async function render(html, file) {
  // Written next to the source so relative font, logo and screenshot paths resolve.
  const htmlPath = join(manualDir, ".render.html");
  writeFileSync(htmlPath, html);
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: file, format: "A4", printBackground: true, preferCSSPageSize: true });
  await page.close();
  rmSync(htmlPath);
}

function findPages(pdf, entries) {
  const pages = {};
  const count = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [pdf]).toString())[1]);
  for (let p = 1; p <= count; p++) {
    const text = execFileSync("pdftotext", ["-f", String(p), "-l", String(p), pdf, "-"]).toString();
    for (const e of entries) if (!pages[e.key] && text.includes(e.key)) pages[e.key] = p;
  }
  const missing = entries.filter((e) => !pages[e.key]);
  if (missing.length) throw new Error(`Could not locate: ${missing.map((e) => e.title).join(", ")}`);
  return { pages, count };
}

const browser = await chromium.launch();
try {
  for (const name of which) {
    const [src, out] = DOCS[name];
    const source = readFileSync(join(manualDir, src), "utf8");
    const output = join(root, out);
    const entries = outline(source);
    const base = source.replace("{{DATE}}", date);
    const pass1 = join(work, `${name}-pass1.pdf`);
    await render(withMarkers(base.replace("{{TOC}}", toc(entries)), entries), pass1);
    const { pages } = findPages(pass1, entries);
    await render(base.replace("{{TOC}}", toc(entries, pages)), output);
    const count = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [output]).toString())[1]);
    console.log(`Wrote ${output} (${count} pages)`);
    for (const e of entries.filter((x) => x.level === 1)) console.log(`  p.${String(pages[e.key]).padStart(2)}  ${e.title}`);
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
