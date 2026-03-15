import path from "path";
import { chromium } from "playwright";

const outputPath = path.resolve("docs/screenshots/cli-project-view.png");

const html = String.raw`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>OpenT A2L-Forge CLI Sync</title>
    <style>
      :root {
        color-scheme: dark;
        --bg-a: #0f1729;
        --bg-b: #07111d;
        --panel: rgba(9, 16, 28, 0.86);
        --panel-border: rgba(110, 173, 255, 0.2);
        --text: #e6edf7;
        --muted: #8ca0bc;
        --accent: #72c7ff;
        --success: #62d59b;
        --warn: #ffb86b;
        --danger: #ff7a7a;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", "Helvetica Neue", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(114, 199, 255, 0.22), transparent 35%),
          radial-gradient(circle at bottom right, rgba(98, 213, 155, 0.18), transparent 28%),
          linear-gradient(145deg, var(--bg-a), var(--bg-b));
      }

      .frame {
        width: 1600px;
        height: 900px;
        margin: 0 auto;
        padding: 48px;
        display: grid;
        grid-template-columns: 1.6fr 0.9fr;
        gap: 28px;
      }

      .hero {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        width: fit-content;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(114, 199, 255, 0.12);
        color: #cfe9ff;
        font-size: 18px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: 56px;
        line-height: 1.02;
        letter-spacing: -0.03em;
      }

      .subcopy {
        max-width: 880px;
        margin: 0;
        font-size: 24px;
        line-height: 1.5;
        color: var(--muted);
      }

      .terminal {
        margin-top: 18px;
        border-radius: 28px;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        background: linear-gradient(180deg, rgba(16, 24, 38, 0.98), rgba(8, 12, 20, 0.98));
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.36);
      }

      .terminal-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 22px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.02);
      }

      .terminal-title {
        font-size: 18px;
        color: #b7c7de;
      }

      .lights {
        display: flex;
        gap: 8px;
      }

      .lights span {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        opacity: 0.9;
      }

      .lights span:nth-child(1) { background: #ff6c6b; }
      .lights span:nth-child(2) { background: #f7c56b; }
      .lights span:nth-child(3) { background: #65d58b; }

      pre {
        margin: 0;
        padding: 26px 28px 30px;
        font: 21px/1.7 "Cascadia Code", "SFMono-Regular", Consolas, monospace;
        color: #d8e7f8;
        white-space: pre-wrap;
      }

      .prompt { color: var(--success); }
      .path { color: var(--accent); }
      .key { color: #9ad6ff; }
      .string { color: #f9d48b; }
      .warn { color: var(--warn); }
      .ok { color: var(--success); }

      .side {
        display: grid;
        gap: 18px;
      }

      .card {
        border-radius: 24px;
        padding: 24px;
        background: var(--panel);
        border: 1px solid var(--panel-border);
        box-shadow: 0 18px 56px rgba(0, 0, 0, 0.24);
      }

      .card h2 {
        margin: 0 0 14px;
        font-size: 24px;
      }

      .card p {
        margin: 0;
        font-size: 18px;
        line-height: 1.55;
        color: var(--muted);
      }

      .list {
        display: grid;
        gap: 12px;
        margin-top: 18px;
      }

      .list-item {
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.06);
        font: 17px/1.4 "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      }

      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }

      .pill {
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 15px;
        background: rgba(114, 199, 255, 0.11);
        color: #cfe9ff;
      }
    </style>
  </head>
  <body>
    <main class="frame">
      <section class="hero">
        <div class="eyebrow">CLI sync for build systems</div>
        <h1>Headless A2L updates with structured output.</h1>
        <p class="subcopy">
          Save a sync project once in the desktop app, then run repeatable ELF-to-A2L updates from CI with
          JSON output, stale-item detection, and explicit report or prune behavior.
        </p>

        <div class="terminal">
          <div class="terminal-top">
            <div class="terminal-title">opent_a2l_forge_cli sync</div>
            <div class="lights"><span></span><span></span><span></span></div>
          </div>
          <pre><span class="prompt">$</span> opent_a2l_forge_cli sync --project <span class="path">engine.a2lsync.json</span> --missing report --json
{
  "<span class="key">project_path</span>": "<span class="string">engine.a2lsync.json</span>",
  "<span class="key">resolved_names</span>": [
    "<span class="string">struct_b.s1.enumval</span>",
    "<span class="string">struct_b.s1.val_i32</span>",
    "<span class="string">struct_b.s2.val_f32</span>"
  ],
  "<span class="key">replaced_names</span>": ["<span class="string">struct_b.s1.val_i32</span>"],
  "<span class="key">imported_names</span>": ["<span class="string">struct_b.s2.val_f32</span>"],
  "<span class="key">stale_names</span>": ["<span class="string">struct_b.legacy_enum</span>"],
  "<span class="key">unresolved_selectors</span>": []
}

<span class="warn">exit code: 2</span>
<span class="ok">build stops safely until stale tracked items are reviewed</span></pre>
        </div>
      </section>

      <aside class="side">
        <section class="card">
          <h2>Tracked selectors</h2>
          <p>The GUI authors the sync scope. The CLI keeps it repeatable.</p>
          <div class="list">
            <div class="list-item">struct_root: struct_b</div>
            <div class="list-item">symbol: val_u8</div>
          </div>
          <div class="pill-row">
            <span class="pill">missing: report</span>
            <span class="pill">module: test</span>
            <span class="pill">json output</span>
          </div>
        </section>

        <section class="card">
          <h2>Behavior</h2>
          <p>
            Use <strong>report</strong> to fail the build when tracked content disappears, or switch to
            <strong>prune</strong> when you want stale managed characteristics removed automatically.
          </p>
        </section>
      </aside>
    </main>
  </body>
</html>
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: outputPath });
await browser.close();
