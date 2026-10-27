# Installing and building SmartText AI on Windows

Supported: **Windows 10 (1803+) and Windows 11, 64-bit (x64)**.

> Status: the Windows build configuration (MSI via WiX, and an NSIS installer) and the CI workflow are included, but no Windows build has been made or tested yet. The project was developed on Linux. Run the commands below on Windows, or use the **Release builds** GitHub Actions workflow.

## 1. Install as a user

- **NSIS installer:** run `SmartText-AI_1.0.0_x64-setup.exe`. It offers English or Arabic and installs for the current user.
- **MSI:** run `SmartText-AI_1.0.0_x64_en-US.msi`. Suited to IT or group-policy deployment.

The app needs the Microsoft **Edge WebView2** runtime. It is built into Windows 11 and current Windows 10. If it is missing, the installer downloads it, so the first install needs an internet connection.

**SmartScreen:** unsigned installers show "Windows protected your PC". Click **More info → Run anyway**. Signed builds (see §5) build up SmartScreen reputation over time.

## 2. Developer prerequisites

1. **Microsoft C++ Build Tools**: install "Desktop development with C++" from <https://visualstudio.microsoft.com/visual-cpp-build-tools/>.
2. **WebView2**: already present on Windows 11 and current Windows 10.
3. **Rust** (MSVC toolchain), in PowerShell:
   ```powershell
   winget install --id Rustlang.Rustup
   rustup default stable-msvc
   ```
4. **Node.js 22**: `winget install OpenJS.NodeJS.LTS`
5. For MSI builds, Tauri downloads WiX automatically. WiX needs the Windows feature **VBSCRIPT** (Settings → System → Optional features).

## 3. Install dependencies and run in development mode

```powershell
git clone <your-repo-url> smarttext-ai
cd smarttext-ai
npm ci
npm test
npm run tauri dev
```

## 4. Production build

```powershell
npm run tauri build
```

Outputs:

- `src-tauri\target\release\bundle\msi\SmartText AI_1.0.0_x64_en-US.msi`
- `src-tauri\target\release\bundle\nsis\SmartText AI_1.0.0_x64-setup.exe`

To build only one type: `npm run tauri build -- --bundles nsis` (or `msi`).

## 5. Code signing

Unsigned builds work but trigger SmartScreen warnings. To sign with a code-signing certificate installed in the certificate store, add to `src-tauri/tauri.conf.json` → `bundle.windows`:

```json
"certificateThumbprint": "YOUR_CERT_SHA1_THUMBPRINT",
"digestAlgorithm": "sha256",
"timestampUrl": "http://timestamp.digicert.com"
```

EV certificates and cloud HSM signing (for example Azure Trusted Signing) are also supported by Tauri through a custom `signCommand`. See the Tauri "Windows Code Signing" guide.

## 6. Where data is stored

- Settings, history, conversations, images: `%APPDATA%\com.ismaielalmarie.smarttextai\smarttext.db`
- API keys: **Windows Credential Manager** → Windows Credentials (entries for `com.ismaielalmarie.smarttextai`)

To uninstall: use Settings → Apps → SmartText AI → Uninstall, then optionally delete the folder above and the Credential Manager entries.

## Troubleshooting

| Problem | Fix |
|---|---|
| `link.exe not found` / `MSVC` errors | Install "Desktop development with C++" (Build Tools) and restart the terminal. |
| MSI step fails with a WiX / `light.exe` error | Enable the VBSCRIPT optional feature, or build NSIS only: `npm run tauri build -- --bundles nsis`. |
| App window is blank | Repair or install WebView2 Runtime (Evergreen) from Microsoft. |
| "Windows protected your PC" | The build is unsigned: **More info → Run anyway**, or sign it (§5). |
| 32-bit or ARM Windows | Not supported by this configuration (x64 only). |
