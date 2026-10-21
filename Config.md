# Config files explained

What every setting in the project's config files does, and why it is set the way it is. Some of these files
are JSON, and JSON can't hold comments, so the explanations live here instead. When you change a config
file, update the matching section here.

| File | What it configures |
|---|---|
| [`package.json`](#packagejson) | Project name, npm scripts, dependencies |
| [`vite.config.js`](#viteconfigjs) | The dev server and the build |
| [`tsconfig.json`](#tsconfigjson) | TypeScript type checking |
| [`playwright.config.js`](#playwrightconfigjs) | The end-to-end tests |
| [`.github/workflows/tests.yml`](#githubworkflowstestsyml) | CI: what GitHub runs on every push |
| [`.gitignore`](#gitignore) | Files Git doesn't track |
| [`src-tauri/`](#src-tauri) | The Tauri desktop app |

---

## `package.json`

The project's identity card for npm.

### Top-level fields

| Setting | Meaning |
|---|---|
| `"name": "designroutes"` | The package name. Required by npm even for a project that's never published. |
| `"private": true` | Stops `npm publish` from ever uploading the project to the public npm registry by accident. |
| `"description"` | One-line summary. Shown by some tools, otherwise cosmetic. |
| `"license"` | The licence identifier. Should match `LICENSE.md` (see "Other notes" in `MigrationPlan.md`). |
| `"type": "module"` | `.js` files in this project use `import`/`export` (ES modules) rather than the older `require()`. This is why `vite.config.js` and `playwright.config.js` can use `import`. |

### `scripts`

Shortcuts run with `npm run <name>` (`npm test` is short for `npm run test`). Inside a script, npm puts
`node_modules/.bin` on the path, so `vite` and `tsc` work without `npx`.

| Script | Runs | Use it to |
|---|---|---|
| `dev` | `vite` | Start the dev server (http://localhost:5173). Reloads on save. |
| `build` | `vite build` | Write the single-file `dist/DesignRoutes-editor.html`. |
| `tauri` | `tauri` | Run the Tauri CLI: `npm run tauri dev`, `npm run tauri build`. Arguments after the name go to the CLI. |
| `typecheck` | `tsc --noEmit` | Check the TypeScript types. Vite never checks types, so this is the only thing that will. `--noEmit` = check only, write no files. |
| `test` | `npm run build && playwright test` | Build, then run every test. `&&` means "only if the build succeeded". |
| `test:ui` | `npm run build && playwright test --ui` | Same, but in Playwright's interactive window where you can watch and step through tests. |

### `dependencies` vs `devDependencies`

- **`dependencies`**: code that ends up *inside* the built app. `react` and `react-dom` are here.
  Installed with `npm install <pkg>`.
- **`devDependencies`**: tools only needed while developing or building. Installed with `npm install -D <pkg>`.

| Package | Section | Why it's here |
|---|---|---|
| `react` | deps | Components, hooks (`useState`, `useEffect`, …). |
| `react-dom` | deps | Puts React components into a web page's DOM. |
| `vite` | dev | Dev server and bundler. |
| `@vitejs/plugin-react` | dev | Lets Vite understand JSX, and gives Fast Refresh (components update without a page reload). |
| `vite-plugin-singlefile` | dev | Inlines all JS and CSS into the built HTML so it works from disk. Has an accepted `npm audit` warning; see Gotchas in `MigrationPlan.md`. |
| `typescript` | dev | The `tsc` compiler, used only to check types. |
| `@types/react`, `@types/react-dom` | dev | Type descriptions for React, which is written in plain JS. Every `@types/…` package does this for some library. |
| `@playwright/test` | dev | The end-to-end test runner. Pinned to an exact version (no `^`) because Playwright's browser builds are tied to the package version. |
| `jszip` | dev | Reads and writes `.vsdx`/zip files. It *does* ship in the built app, so strictly it belongs in `dependencies`. Because the app is bundled into one file, the section makes no practical difference here. |

### Version ranges

- `^8.3.4` means "8.3.4 or any later **8.x**". You get bug fixes and features, but no new major version,
  which is where breaking changes go.
- `~6.0.2` would mean "6.0.x only".
- `1.56.1` with no symbol means exactly that version.
- The exact versions actually installed are recorded in `package-lock.json`. Commit it, never edit it by
  hand. `npm ci` (used in CI) installs exactly what the lock file says.

> **Watch out:** `npm install` and `npm uninstall` rewrite `package.json`. Save your own edits to it before
> running them, or the command can overwrite an unsaved change.

---

## `vite.config.js`

Vite is the dev server (`npm run dev`) and the bundler (`npm run build`). This file is ordinary JavaScript,
so it *can* have comments.

```js
import {defineConfig} from 'vite'
import {viteSingleFile} from 'vite-plugin-singlefile'
import react from '@vitejs/plugin-react'
```

- `{defineConfig}` and `{viteSingleFile}` are **named exports**: the braces ask for an export with exactly
  that name.
- `react` is a **default export**: no braces, and you can call it whatever you like.

### The `renameHtml` plugin

```js
function renameHtml(from, to) {
    return {
        name: 'rename-html',
        enforce: 'post',
        generateBundle(options, bundle) {
            bundle[from].fileName = to
        },
    }
}
```

Vite names the built page after its source file (`src/index.html` → `dist/index.html`), and there's no
setting to change that. This small plugin of our own renames it, so `src/index.html` and the dev URL stay
the same.

| Part | Meaning |
|---|---|
| `function renameHtml(from, to)` | A function that *returns* a plugin. That's how every Vite plugin works, `react()` and `viteSingleFile()` included. |
| `name` | A label shown in error messages. |
| `enforce: 'post'` | Run after Vite's own steps. Without it, the plugin runs before Vite has created the HTML file and fails with `Cannot set properties of undefined`. |
| `generateBundle(options, bundle)` | A **hook**: Vite calls it when every output file has been prepared in memory but not yet written to disk. `bundle` holds every output file, keyed by name. `options` isn't used but must be listed, because `bundle` is the second value passed in. |
| `bundle[from].fileName = to` | Changes the name the file is saved under. |

### The settings

| Setting | Meaning |
|---|---|
| `root: 'src'` | The website's files are in `src/`. The dev server serves that folder, and other paths in this file are worked out from it. |
| `plugins: [...]` | Plugins run **in this order** at each stage. `viteSingleFile()` etc. are *called* (with brackets) so that each returns its plugin object. |
| `react()` | First, because JSX has to be turned into plain JavaScript before anything else touches the code. |
| `viteSingleFile()` | Inlines the generated JS and CSS into the HTML and deletes the separate files. |
| `renameHtml('index.html', 'DesignRoutes-editor.html')` | See above. |
| `build.outDir: '../dist'` | Where `vite build` writes to. It's relative to `root`, so `..` goes up out of `src` into the repo's `dist`. The default would be `src/dist`. |
| `build.emptyOutDir: true` | Delete what's in `dist` before each build. Vite only does this automatically when the folder is *inside* `root`, so outside it you have to opt in. Safe here: `dist` only ever holds the built file. |

`build` settings only affect `npm run build`, not `npm run dev`.

---

## `tsconfig.json`

Settings for the TypeScript compiler (`tsc`), which this project uses **only to check types**. Vite runs
`.ts`/`.tsx` files by stripping the types out, without checking them. `tsconfig.json` is a relaxed form of
JSON: comments and trailing commas are allowed.

The plan: new code (React components) is written as `.ts`/`.tsx`, and the existing engine in `src/js/` stays
`.js` and unchecked until each file is converted (Stage 4 in `MigrationPlan.md`). Converted engine files move
to `src/engine/`, one file at a time: the move in its own commit (so git keeps the file's history), the
conversion in place. New engine files go straight into `src/engine/` as `.ts`.

| Setting | Meaning |
|---|---|
| `"include": ["src"]` | Check files under `src/`. Tests and config files are ignored. |
| `"target"` | Which JavaScript version to assume the code runs on. Since `noEmit` is on, it doesn't change any output. It only affects which syntax TypeScript accepts. **Currently `es2015`; the plan was `es2023`** (see the note below the table). |
| `"lib"` | Which built-in things exist. `ES20xx` = the language's own features (`Array`, `Map`, `Promise`, …); `DOM` = the browser's (`document`, `window`, events) and without it `document` would be an error; `DOM.Iterable` = looping over browser lists with `for…of`. |
| `"module": "esnext"` | Code uses modern `import`/`export`. |
| `"moduleResolution": "bundler"` | Resolve imports the way Vite does, e.g. `from 'jszip'` finds the package in `node_modules`. |
| `"types": ["vite/client"]` | Adds Vite's extras: `import.meta.env`, and importing `.css`/image files from code. |
| `"jsx": "react-jsx"` | Read JSX the React way. No `import React` needed at the top of each file. |
| `"strict": true` | All the strict checks. Most noticeably, a value that might be `null` (like `getElementById`'s result) must be checked before use. Much easier to start strict than to switch it on later. |
| `"allowJs": true` | `.ts`/`.tsx` files may import `.js` files. Needed so React code can start the engine (`main.ts`). |
| `"checkJs": false` | …but don't report problems *inside* `.js` files, which were never written for TypeScript. Can be switched on later to find problems before converting a file. |
| `"noEmit": true` | Check only. Never write output files; Vite does the building. |
| `"skipLibCheck": true` | Don't check type files of installed packages (`@types/…`, `node_modules`). Faster, and their errors aren't ours to fix. |
| `"verbatimModuleSyntax": true` | Type-only imports must be written `import type {…}`, so it's always clear which imports vanish when the types are removed. |
| `"moduleDetection": "force"` | Treat every file as its own module, so a name declared in one file can't clash with the same name in another. |

> **`target`/`lib` are `es2015`, not `es2023`.** With `ES2015` in `lib`, TypeScript doesn't know about
> anything added to JavaScript after 2015: `Array.prototype.includes` (2016), `Object.entries` (2017),
> `Array.prototype.flat` (2019), `at()` (2022) and so on. Using any of them in a `.ts`/`.tsx` file would be
> reported as an error, even though every current browser supports them. Unless 2015 was chosen on purpose,
> set both back to `es2023`.

---

## `playwright.config.js`

The end-to-end tests: Playwright opens a real Chromium browser and clicks through the app.

| Setting | Meaning |
|---|---|
| `PORT` | The port the dev server runs on during tests: `8123`, or `TEST_PORT` if that environment variable is set. Not Vite's usual 5173, so tests don't clash with a `npm run dev` you already have open. |
| `testDir: 'tests/e2e'` | Where the test files (`*.spec.js`) are. The `docs` project overrides it with its own `testDir: 'tests/docs'`, so the two sets of specs never mix. |
| `fullyParallel: true` | Run tests at the same time across several browser workers. Faster. |
| `forbidOnly: !!process.env.CI` | On CI, fail if a test was left marked `test.only(…)`, which would silently skip every other test. (`!!` turns "is set / isn't set" into `true`/`false`.) |
| `retries` | Retry a failed test once on CI, never locally. Smooths over the occasional flaky run on GitHub's slower machines. |
| `reporter` | Locally: `list`, one line per test. On CI: `list` plus an `html` report, which the workflow uploads. |
| `use.devices['Desktop Chrome']` | Browser settings matching desktop Chrome. |
| `use.viewport` | Window size 1400×900, so layouts are the same on every machine. |
| `use.trace: 'retain-on-failure'` | Record a trace (screenshots, DOM, network, step by step) and keep it only for tests that fail. Open with `npx playwright show-trace <file>`. |
| `projects` | Every test runs once per project: **`modules`** loads the source through the dev server (`http://localhost:8123/index.html`); **`bundle`** opens the built `dist/DesignRoutes-editor.html` straight from disk (`file://`), which is how most people use the editor. `appUrl` is a custom option defined in `tests/e2e/fixtures.js`. A third project, **`docs`**, runs only `tests/docs`: it rebuilds every picture in the documentation with the app (the shape gallery, a PNG of each diagram page, the README screenshot) and fails if a diagram in `docs/diagrams` or `examples` has an error. It uses the dev server like `modules`, because it imports the app's own modules to export PNGs, and a 1440×810 window so the screenshot is a standard 16:9. |
| `webServer.command` | Starts Vite for the `modules` and `docs` projects. `--strictPort` makes it fail if 8123 is taken, instead of quietly moving to another port that Playwright isn't watching. |
| `webServer.url` | Playwright waits until this URL answers before starting the tests. |
| `webServer.reuseExistingServer` | Locally, if something is already running on that port, use it rather than starting another. On CI, always start fresh. |

The browser itself comes from `npx playwright install chromium`, and its build has to match the
`@playwright/test` version. Run it again after upgrading Playwright.

---

## `.github/workflows/tests.yml`

What GitHub Actions runs. YAML: indentation is meaningful, so use spaces, never tabs.

| Part | Meaning |
|---|---|
| `on.push` / `on.pull_request` | Run on pushes to, and pull requests into, `main`. |
| `runs-on: ubuntu-latest` | A fresh Linux machine from GitHub for each run. |
| `actions/checkout@v7` | Download the repo onto that machine. |
| `actions/setup-node@v7` + `node-version: 22` | Install Node 22 (matches the local machine). `cache: npm` reuses downloaded packages between runs. |
| `npm ci` | Install exactly what `package-lock.json` says. Stricter than `npm install`: fails if `package.json` and the lock file disagree. |
| `npx playwright install --with-deps chromium` | The test browser, plus the Linux system libraries it needs. |
| `npm test` | Build and run all tests. A failure here fails the run. |
| `actions/upload-artifact@v4` | Save `playwright-report/` so it can be downloaded from the run's page for 14 days. `if: !cancelled()` = do this even when tests failed, which is when the report is most useful. **Still `@v4`; should be `@v7`** to clear the last Node 20 warning. |

`@v7` means "the latest v7 release": bug fixes arrive automatically, breaking changes don't.

To add: a `- run: npm run typecheck` step before `npm test`, once there are `.ts`/`.tsx` files to check.

---

## `.gitignore`

| Line | Why it's not tracked |
|---|---|
| `node_modules/` | Installed packages. Recreated from `package-lock.json` by `npm install`. |
| `test-results/` | Playwright's per-run output (traces of failed tests). |
| `playwright-report/` | The HTML report. |
| `/.idea/jsLibraryMappings.xml` | A WebStorm file specific to this machine. |

`dist/` is **not** ignored on purpose: the built `DesignRoutes-editor.html` is committed so people can download
and open it without building anything. Rebuild and commit it along with any change to `src/`.

---

## `src-tauri/`

The desktop app. Created by `tauri init` (2026-10-18). Tauri is a small Rust program that opens a window using
the system's web view (WebView2 on Windows, which is Chromium) and loads our built page into it. Nothing in `src/`
knows it's running there.

| File | What it is |
|---|---|
| `tauri.conf.json` | The main settings (below). |
| `Cargo.toml` | Rust's `package.json`: crate name (`designroutes`, which names the `.exe`), and the Rust dependencies (`tauri`, `tauri-plugin-log`, `serde`). `Cargo.lock` appears after the first build and should be committed, like `package-lock.json`. |
| `build.rs` | Runs `tauri_build::build()` before compiling: embeds the icon and config. Leave it alone. |
| `src/main.rs` | The program's entry point; just calls `run()` in `lib.rs`. The `windows_subsystem` line stops a console window opening behind the app in release builds. |
| `src/lib.rs` | Builds the app: adds the log plugin in debug builds, then runs. Native plugins (dialog, fs) get added here. |
| `capabilities/default.json` | What the page is allowed to ask Rust to do. `core:default` = the basics only; each plugin added later needs its permissions listed here. |
| `icons/` | Placeholder Tauri icons. Replace with `npx tauri icon <a 1024px png>`. |
| `.gitignore` | Ignores `target/` (Rust's build output, gigabytes) and `gen/schemas`. |

### `tauri.conf.json`

| Setting | Meaning |
|---|---|
| `productName`, `version` | The app's name and version, shown in the installer and the window's details. |
| `identifier` | A unique reverse-domain id (`com.routeshealthcare.designroutes`). Used for the app's data folder. `tauri build` refuses the default `com.tauri.dev`. |
| `build.frontendDist: "../dist"` | Where `vite build` writes the page; built into the `.exe`. |
| `build.devUrl` | The page `tauri dev` loads instead: the Vite dev server. |
| `build.beforeDevCommand` | `npm run dev -- --port 5173 --strictPort`: starts Vite first. `--strictPort` so Vite fails rather than moving to another port that Tauri isn't watching. |
| `build.beforeBuildCommand` | `npm run build` before packaging, so the `.exe` always has a fresh page. |
| `app.windows[0].url: "DesignRoutes-editor.html"` | Tauri opens `index.html` by default, but the `renameHtml` plugin in `vite.config.js` renames ours. |
| `app.windows[0].dragDropEnabled: false` | Lets the page handle drag and drop itself. Tauri's own handler (for getting dropped file paths in Rust) otherwise swallows the browser drag events, so dragging from the palette did nothing. Files dropped from Explorer still arrive as ordinary drops, which `Stage.tsx` handles. |
| `app.windows[0].width/height` | Starting window size (1400 × 900). |
| `app.security.csp: null` | No Content Security Policy. Fine while the page loads nothing from the internet; worth setting before release. |
| `bundle.targets: "all"` | Every installer type for the platform (on Windows: MSI via WiX and an NSIS `.exe`). |
| `bundle.icon` | The icon files from `icons/`. |
