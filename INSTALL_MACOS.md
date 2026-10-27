# Installing and building SmartText AI on macOS

Supported: macOS 10.15 or later, on **Apple Silicon (arm64)** and **Intel (x86_64)**.

> Status: the macOS build configuration and the CI workflow are included, but no macOS build has been made or tested yet. The project was developed on Linux. Run the commands below on a Mac, or use the **Release builds** GitHub Actions workflow.

## 1. Install as a user

1. Open `SmartText-AI_1.0.0_universal.dmg` (one app for both Apple Silicon and Intel Macs; the release workflow builds this universal DMG) and drag **SmartText AI** into **Applications**.
2. First launch of an **unsigned** build: macOS Gatekeeper will block it ("cannot be opened because the developer cannot be verified"). Either:
   - right-click the app in Applications → **Open** → **Open**, or
   - System Settings → Privacy & Security → **Open Anyway**, or
   - in Terminal: `xattr -dr com.apple.quarantine "/Applications/SmartText AI.app"`
3. Signed and notarized builds (see §5) open without warnings.

When you save an API key, macOS may ask to allow access to the login keychain. Click **Always Allow**.

## 2. Developer prerequisites

```bash
xcode-select --install                                   # Xcode Command Line Tools
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
brew install node@22                                     # or use nvm / the official installer
```

## 3. Install dependencies and run in development mode

```bash
git clone <your-repo-url> smarttext-ai && cd smarttext-ai
npm ci
npm test
npm run tauri dev
```

## 4. Production build

```bash
npm run tauri build                                      # host architecture
npm run tauri build -- --target aarch64-apple-darwin     # Apple Silicon
npm run tauri build -- --target x86_64-apple-darwin      # Intel
npm run tauri build -- --target universal-apple-darwin   # one universal app for both
```

Outputs:

- `src-tauri/target/<target>/release/bundle/macos/SmartText AI.app`
- `src-tauri/target/<target>/release/bundle/dmg/SmartText AI_1.0.0_<arch>.dmg`

(without `--target`, the path is `src-tauri/target/release/bundle/…`)

## 5. Signing and notarization (public distribution)

You need an Apple Developer Program membership and a **Developer ID Application** certificate in your keychain.

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"     # appleid.apple.com → App-Specific Passwords
export APPLE_TEAM_ID="TEAMID"
npm run tauri build -- --target universal-apple-darwin
```

Tauri signs the app, submits it for notarization and staples the ticket when these variables are set.
In CI, store the same values as repository secrets (`APPLE_CERTIFICATE` is the base64-encoded `.p12` and `APPLE_CERTIFICATE_PASSWORD` is its password). `.github/workflows/release.yml` passes them through.

## 6. Where data is stored

- Settings, history, conversations, images: `~/Library/Application Support/com.ismaielalmarie.smarttextai/smarttext.db`
- API keys: the login Keychain, service `com.ismaielalmarie.smarttextai`, accounts `openai`, `anthropic`, `openai_compatible`

To uninstall, delete the app, the folder above and the Keychain entries (Keychain Access → search "smarttextai").

## Troubleshooting

| Problem | Fix |
|---|---|
| "App is damaged and can't be opened" | The download is quarantined and unsigned: `xattr -dr com.apple.quarantine "/Applications/SmartText AI.app"` |
| `error: target not installed` while building | `rustup target add aarch64-apple-darwin x86_64-apple-darwin` |
| `xcrun: error: invalid active developer path` | `xcode-select --install` |
| Key cannot be saved ("system keychain is unavailable") | Unlock the login keychain in Keychain Access. Allow access when prompted. |
| Wrong architecture DMG | Apple Silicon needs `aarch64`, Intel needs `x64`. The universal build runs on both. |
