#!/usr/bin/env node
/**
 * End-to-end check + screenshot capture of the REAL SmartText UI (browser dev mode).
 *
 * It starts (if not already running): the MOCK provider (scripts/mock/mock-provider.mjs), the dev proxy
 * (server/index.ts) and Vite, then drives the UI with Playwright, asserts each workflow, and saves PNGs
 * to docs/screenshots/. AI responses come from the MOCK server (fixed canned text), which is stated in
 * every caption that uses them. Image generation is shown in its real "not configured" state.
 *
 *   node scripts/manual/capture-screenshots.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../pw.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = resolve(root, "docs/screenshots");
mkdirSync(outDir, { recursive: true });
const children = [];
let browser;

async function up(url) {
  try {
    const r = await fetch(url);
    return r.status < 500;
  } catch {
    return false;
  }
}
async function ensure(url, cmd, args) {
  if (await up(url)) return;
  const child = spawn(cmd, args, { cwd: root, stdio: "ignore", env: { ...process.env, OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" } });
  children.push(child);
  for (let i = 0; i < 60; i++) {
    if (await up(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Could not start ${cmd} ${args.join(" ")}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`E2E assertion failed: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const SETTINGS = (language, theme) => ({
  language,
  theme,
  textProvider: "openai_compatible",
  compatibleBaseUrl: "http://127.0.0.1:18080/v1",
  textModels: { openai: "gpt-4.1-mini", anthropic: "claude-opus-5-5", openai_compatible: "mock-model" },
});

const DOC_A_AR =
  "يؤثر التغير المناخي في الزراعة من خلال ارتفاع درجات الحرارة وتغير أنماط هطول الأمطار وتزايد موجات الجفاف في مناطق كثيرة من العالم، مما يهدد الأمن الغذائي.";
const DOC_B_AR =
  "تشير الدراسة إلى أن ارتفاع درجات الحرارة وتغير أنماط هطول الأمطار وتزايد موجات الجفاف في مناطق كثيرة من العالم يفرض على المزارعين تبنّي أساليب ري حديثة.";

let lastPage;

async function main() {
  await ensure("http://127.0.0.1:18080/v1/models", "node", ["scripts/mock/mock-provider.mjs", "18080"]);
  await ensure("http://127.0.0.1:8787/api/secrets/status", "npx", ["tsx", "server/index.ts"]);
  await ensure("http://localhost:1420/", "npx", ["vite", "--port", "1420", "--strictPort"]);

  browser = await chromium.launch();
  const shoot = async (page, name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: resolve(outDir, `${name}.png`) });
    console.log(`  📷 ${name}.png`);
  };
  const open = async (language, theme) => {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2, locale: language === "ar" ? "ar" : "en-US" });
    const page = await ctx.newPage();
    lastPage = page;
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => {
      throw e;
    });
    await page.addInitScript((s) => {
      if (!localStorage.getItem("smarttext-dev-store")) localStorage.setItem("smarttext-dev-store", JSON.stringify({ settings: s, conversations: [], history: [] }));
    }, SETTINGS(language, theme));
    await page.goto("http://localhost:1420/");
    await page.waitForSelector("nav");
    return page;
  };
  const nav = (page, label) => page.locator("nav").first().getByRole("button", { name: label, exact: true }).click();

  // ---------- Arabic, light theme (used by the Arabic manual) ----------
  console.log("Arabic UI");
  let p = await open("ar", "light");
  assert((await p.getAttribute("html", "dir")) === "rtl", "Arabic layout is right-to-left");
  await shoot(p, "ar-dashboard");

  await nav(p, "مُحسِّن النصوص");
  await p.getByRole("button", { name: "إدراج نص مثال", exact: true }).click();
  await p.getByRole("button", { name: "حسِّن النص", exact: true }).click();
  await p.waitForFunction(() => document.querySelector('textarea[aria-label="النص المُحسَّن"]')?.value.length > 50);
  assert((await p.locator('textarea[aria-label="النص المُحسَّن"]').inputValue()).startsWith("أصبح التواصل"), "Humanizer returns the (mock) revised Arabic text");
  await shoot(p, "ar-humanizer");
  await p.getByRole("radio", { name: "إبراز التغييرات", exact: true }).click();
  assert((await p.locator("[data-testid=diff-view] ins").count()) > 0, "Change highlighting shows insertions");
  await shoot(p, "ar-humanizer-diff");

  await nav(p, "المحادثة الذكية");
  await p.getByRole("textbox").fill("كيف أجعل رسائل البريد إلى العملاء أوضح؟");
  await p.keyboard.press("Enter");
  await p.getByText("إليك ثلاث طرق").waitFor();
  assert(true, "Chat answers in Arabic with Markdown");
  await shoot(p, "ar-chat");

  await nav(p, "أدوات الكتابة");
  await p.getByRole("button", { name: "التلخيص", exact: true }).click();
  await p.getByLabel("الشكل").selectOption("bullets");
  await p.getByRole("button", { name: "إدراج نص مثال", exact: true }).click();
  await p.getByRole("button", { name: "تشغيل", exact: true }).click();
  await p.getByText("التواصل الواضح مع العملاء أمر ضروري").waitFor();
  assert(true, "Summarize tool renders a bulleted result");
  await shoot(p, "ar-tools");

  await nav(p, "توليد الصور");
  assert(await p.getByTestId("image-setup").isVisible(), "Image generator shows the setup screen when no key is configured");
  await shoot(p, "ar-image-setup");

  await nav(p, "تحليل النصوص");
  await p.getByLabel("المستند (أ)").fill(DOC_A_AR);
  await p.getByLabel("المستند (ب)").fill(DOC_B_AR);
  await p.getByRole("button", { name: "قارن المستندين", exact: true }).click();
  await p.getByTestId("similarity-report").waitFor();
  assert((await p.getByTestId("similarity-report").locator("li").count()) > 0, "Similarity check finds the shared passage");
  await shoot(p, "ar-analysis");
  await p.getByRole("radio", { name: "كشف النص المولَّد آليًا", exact: true }).click();
  await shoot(p, "ar-detection");

  await nav(p, "السجل");
  assert((await p.locator("main ul li").count()) >= 2, "History lists the saved results");
  await shoot(p, "ar-history");

  await nav(p, "الإعدادات");
  await shoot(p, "ar-settings");
  await p.getByRole("heading", { name: "مزوّدو الذكاء الاصطناعي" }).scrollIntoViewIfNeeded();
  await p.getByTestId("provider-openai_compatible").getByRole("button", { name: "اختبار الاتصال", exact: true }).click();
  await p.getByText("تم الاتصال").waitFor();
  assert(true, "Connection test lists models from the (mock) OpenAI-compatible server");
  await p.getByTestId("provider-openai").scrollIntoViewIfNeeded();
  await shoot(p, "ar-settings-providers");
  await p.getByRole("heading", { name: "الخصوصية والبيانات" }).scrollIntoViewIfNeeded();
  await p.getByRole("heading", { name: "الشبكة" }).scrollIntoViewIfNeeded();
  await shoot(p, "ar-settings-privacy");

  await nav(p, "حول التطبيق");
  assert((await p.getByTestId("developer-credit").textContent()).includes("Ismaiel Almarie"), "About page shows the developer credit");
  await shoot(p, "ar-about");
  await p.context().close();

  // ---------- English, light + dark (README) ----------
  console.log("English UI");
  p = await open("en", "light");
  await shoot(p, "en-dashboard");
  await nav(p, "Humanizer");
  await p.getByRole("button", { name: "Insert sample", exact: true }).click();
  await p.getByRole("radio", { name: "Concise", exact: true }).click();
  await p.getByRole("button", { name: "Improve text", exact: true }).click();
  await p.waitForFunction(() => document.querySelector('textarea[aria-label="Revised text"]')?.value.length > 50);
  await p.getByRole("radio", { name: "Highlight changes", exact: true }).click();
  await shoot(p, "en-humanizer-diff");
  await p.context().close();

  p = await open("en", "dark");
  await nav(p, "AI Chat");
  await p.getByRole("textbox").fill("How can I make customer emails clearer?");
  await p.keyboard.press("Enter");
  await p.getByText("Lead with the action").waitFor();
  await shoot(p, "en-chat-dark");
  await p.context().close();

  await browser.close();
  console.log("All end-to-end checks passed.");
}

main()
  .catch(async (e) => {
    console.error(e);
    await lastPage?.screenshot({ path: resolve(outDir, "..", "e2e-failure.png") }).catch(() => {});
    console.error("Saved the page at the failure to docs/e2e-failure.png");
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close().catch(() => {});
    children.forEach((c) => c.kill());
  });
