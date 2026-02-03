# OpenT A2L Forge

A modern desktop application for viewing, editing, and creating ASAP2 (A2L) files, built with Tauri, React, and TypeScript.

## Prerequisites

### General
- **Node.js**: v18 or later
- **Rust**: v1.70 or later (via `rustup`)

### Windows Requirements
To build this application on Windows, you **must** have the C++ Build Tools installed, as they are required by `tauri-build` (for `winres` resource compiling).

1. Install **Visual Studio 2022 Build Tools** (or VS Community).
2. During installation, select the **"Desktop development with C++"** workload.
3. Ensure the **Windows 10/11 SDK** is checked in the optional components on the right.

> **Note:** If you see build errors related to `winres`, `rc.exe`, or `linker`, you are likely missing these tools.

## Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run in development mode**:
   ```bash
   npm run tauri dev
   ```
   This will start the Vite frontend (port 1420) and the Tauri backend window.

## Building for Production

To create a release build (installer/executable):

```bash
npm run tauri build
```
The output can be found in `src-tauri/target/release/bundle`.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
