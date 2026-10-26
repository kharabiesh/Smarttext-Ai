import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
const pkg = JSON.parse(read("package.json"));

describe("build configuration", () => {
  it("Tauri app identity and versions are consistent", () => {
    expect(tauri.productName).toBe("SmartText AI");
    expect(tauri.identifier).toMatch(/^[a-z0-9.]+$/);
    expect(tauri.version).toBe(pkg.version);
    expect(read("src-tauri/Cargo.toml")).toContain(`version = "${pkg.version}"`);
  });

  it("bundles for all targets with existing icons", () => {
    expect(tauri.bundle.active).toBe(true);
    expect(tauri.bundle.targets).toBe("all");
    for (const icon of tauri.bundle.icon) expect(existsSync(resolve(root, "src-tauri", icon)), icon).toBe(true);
    expect(tauri.bundle.macOS.minimumSystemVersion).toBeTruthy();
    expect(tauri.bundle.windows.webviewInstallMode.type).toBeTruthy();
  });

  it("uses a strict CSP: no remote scripts, no eval, no direct network access from the webview", () => {
    const csp: string = tauri.app.security.csp;
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    const connect = csp.split(";").find((d) => d.trim().startsWith("connect-src"))!;
    expect(connect).not.toMatch(/https:\/\/api\./);
    expect(connect).not.toContain("*");
  });

  it("grants only the plugins the app needs", () => {
    const cap = JSON.parse(read("src-tauri/capabilities/default.json"));
    expect(cap.permissions.sort()).toEqual(["core:default", "dialog:default", "sql:allow-execute", "sql:default"]);
  });

  it("uses native credential stores on macOS and Windows", () => {
    const cargo = read("src-tauri/Cargo.toml");
    expect(cargo).toMatch(/target_os = "macos"[\s\S]*keyring[\s\S]*apple-native/);
    expect(cargo).toMatch(/target_os = "windows"[\s\S]*keyring[\s\S]*windows-native/);
  });

  it("Tauri build hooks point at real npm scripts", () => {
    expect(tauri.build.beforeBuildCommand).toBe("npm run build");
    expect(tauri.build.beforeDevCommand).toBe("npm run dev");
    for (const s of ["dev", "build", "test", "tauri", "server", "dev:web"]) expect(pkg.scripts[s], s).toBeTruthy();
  });

  it("CI builds macOS (Apple Silicon + Intel) and Windows installers", () => {
    const wf = read(".github/workflows/release.yml");
    expect(wf).toContain("aarch64-apple-darwin");
    expect(wf).toContain("x86_64-apple-darwin");
    expect(wf).toContain("windows-latest");
  });

  it(".env.example contains placeholders only and .env is git-ignored", () => {
    const env = read(".env.example");
    for (const line of env.split("\n").filter((l) => l.includes("API_KEY="))) expect(line.split("=")[1].trim()).toBe("");
    expect(read(".gitignore")).toMatch(/^\.env$/m);
  });

  it("no API keys are committed in source", () => {
    const files = ["src/lib/ai/registry.ts", "src/state/settings.ts", "server/index.ts", "src-tauri/src/provider.rs", "src-tauri/src/secrets.rs"];
    for (const f of files) expect(read(f), f).not.toMatch(/sk-(proj-|ant-)?[A-Za-z0-9]{20,}/);
  });
});
