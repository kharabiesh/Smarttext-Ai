// Loads Playwright from the project (npm i -D playwright) or, failing that, from the global npm root.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  const root = execSync("npm root -g").toString().trim();
  pw = require(require.resolve("playwright", { paths: [root] }));
}
export const { chromium } = pw;
