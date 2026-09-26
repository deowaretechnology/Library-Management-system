#!/usr/bin/env node
/**
 * Screenshots every page of the running app at desktop and mobile sizes with Playwright
 * (Chromium). Part of the UI screenshot pipeline (.github/workflows/ui-screenshots.yml): run it
 * after scripts/ui-screenshots/seed.ts has seeded the database and `next start` is serving.
 * Playwright is not a project dependency: install it on the fly (npm i --no-save playwright@x).
 *
 *   node scripts/ui-screenshots/capture.mjs
 *
 * Env:
 *   BASE_URL          app origin (default http://localhost:3000). Keep "localhost": the session
 *                     cookie is Secure in production and Chromium accepts that over plain http
 *                     only for localhost.
 *   UI_SEED_IDS_FILE  logins + ids written by seed.ts (default <tmpdir>/ui-seed.json)
 *   UI_SHOTS_DIR      output dir (default ./ui-shots): screenshots/<viewport>/<area>-<slug>.jpg,
 *                     index.md (what gets published) and results.json
 *   UI_SHOTS_ONLY     optional comma-separated substrings of "<area>-<slug>" to capture a subset
 *   UI_LOG_DIR        if set and pages fail, the tail of $UI_LOG_DIR/server.log goes into a warning
 *
 * A page that fails never stops the run: its HTTP status, errors and a screenshot of whatever
 * rendered are recorded in index.md. The exit code is non-zero only when nothing could be
 * captured or a login failed (every page after it would just be the login screen).
 */
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { chromium, devices } from "playwright";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const IDS_FILE = process.env.UI_SEED_IDS_FILE || path.join(os.tmpdir(), "ui-seed.json");
const OUT = path.resolve(process.env.UI_SHOTS_DIR || "ui-shots");
const ONLY = (process.env.UI_SHOTS_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const SETTLE_MS = 900; // after network idle: chart animations, late layout shifts
const JPEG_QUALITY = 72;
const MAX_IMAGE_PX = 16_000; // Chromium can't reliably capture taller full-page images than this

const VIEWPORTS = [
  {
    name: "desktop",
    label: "1440×900, 1x",
    dsf: 1,
    context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  },
  {
    name: "mobile",
    label: "390×844, 2x, touch",
    dsf: 2,
    context: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        devices["Pixel 7"]?.userAgent ??
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    },
  },
];

// Text that means the page crashed even when the status code says otherwise.
const ERROR_MARKERS = [
  [/Application error: a (client|server)-side exception/i, "Next.js application error"],
  [/Something went wrong/i, "error boundary shown"],
  [/Internal Server Error/i, "Internal Server Error"],
];

const log = (...args) => console.log(`[capture ${new Date().toISOString().slice(11, 19)}]`, ...args);
const clip = (s, n = 240) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const shortUrl = (u) => {
  try {
    const url = new URL(u);
    return (url.origin === BASE_URL ? "" : url.host) + url.pathname + (url.search.length > 40 ? url.search.slice(0, 40) + "…" : url.search);
  } catch {
    return clip(u, 100);
  }
};
const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escProp = (s) => esc(s).replace(/:/g, "%3A").replace(/,/g, "%2C");

/* -------------------------------------------------------------------------- */
/* What to capture                                                             */
/* -------------------------------------------------------------------------- */

function pagesFor(ids) {
  const s = ids.demoStudent;
  const enc = encodeURIComponent;
  return {
    public: [
      { slug: "home", url: "/" },
      { slug: "login", url: "/login" },
      { slug: "change-password-first", url: `/change-password?first=1&id=${enc(s.libraryId)}` },
      { slug: "catalog", url: "/catalog" },
      { slug: "not-found", url: "/this-page-does-not-exist", expect: [404] },
      { slug: "privacy-policy", url: "/privacy-policy" },
      { slug: "terms", url: "/terms" },
    ],
    admin: [
      { slug: "dashboard", url: "/admin/dashboard" },
      { slug: "mobile-menu", url: "/admin/dashboard", viewports: ["mobile"], fullPage: false, action: openMobileMenu },
      { slug: "issue", url: "/admin/issue" },
      { slug: "issue-student-loaded", url: "/admin/issue", action: (page) => loadIssueStudent(page, s) },
      { slug: "return", url: "/admin/return" },
      { slug: "renewals", url: "/admin/renewals" },
      { slug: "reservations", url: "/admin/reservations" },
      { slug: "reservations-awaiting-approval", url: "/admin/reservations?status=AWAITING_APPROVAL" },
      { slug: "overdue", url: "/admin/overdue" },
      { slug: "fines", url: "/admin/fines" },
      { slug: "lost-damaged", url: "/admin/lost-damaged" },
      { slug: "entry-exit", url: "/admin/entry-exit" },
      { slug: "students", url: "/admin/students" },
      { slug: "student-detail", url: `/admin/students/${enc(s.studentId)}` },
      { slug: "books", url: "/admin/books" },
      { slug: "book-detail", url: `/admin/books/${enc(ids.book.id)}` },
      { slug: "book-copies", url: "/admin/book-copies" },
      { slug: "authors", url: "/admin/authors" },
      { slug: "publishers", url: "/admin/publishers" },
      { slug: "categories", url: "/admin/categories" },
      { slug: "subjects", url: "/admin/subjects" },
      { slug: "reports", url: "/admin/reports" },
      { slug: "settings", url: "/admin/settings" },
      { slug: "staff", url: "/admin/staff" },
      { slug: "audit-logs", url: "/admin/audit-logs" },
    ],
    student: [
      { slug: "dashboard", url: "/student/dashboard" },
      { slug: "books", url: "/student/books" },
      { slug: "my-books", url: "/student/my-books" },
      { slug: "reservations", url: "/student/reservations" },
      { slug: "history", url: "/student/history" },
      { slug: "visits", url: "/student/visits" },
      { slug: "fines", url: "/student/fines" },
      { slug: "notifications", url: "/student/notifications" },
      { slug: "profile", url: "/student/profile" },
      { slug: "clearance", url: "/student/clearance" },
    ],
  };
}

/** Quick Issue: look the demo student up the way the counter does (type the ID, press Enter). */
async function loadIssueStudent(page, student) {
  const candidates = [page.getByPlaceholder(/student id/i), page.locator("main input:visible")];
  let input = null;
  for (const c of candidates) {
    if ((await c.count()) > 0) {
      input = c.first();
      break;
    }
  }
  if (!input) throw new Error("no student ID input found on the Quick Issue page");
  await input.fill(student.studentId);
  await input.press("Enter");
  await page.getByText(student.name).first().waitFor({ state: "visible", timeout: 20_000 });
  await settle(page, 400);
}

/** Phone-width admin nav: the hamburger in the header opens a drawer. */
async function openMobileMenu(page) {
  await page.locator('button[aria-label="Open menu"]').first().click({ timeout: 10_000 });
  await page.locator('button[aria-label="Close menu"]').first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

/* -------------------------------------------------------------------------- */
/* Mechanics                                                                   */
/* -------------------------------------------------------------------------- */

// A wait that times out on two pages in a row is evidently a property of the UI (a polling
// widget, a decorative pulse), not slowness: from then on it gets a short timeout, so one such
// change in the redesign can't push 80+ pages past the step timeout.
const streak = { idle: 0, skeleton: 0 };

/** Waits until the page looks finished. Returns notes about waits that gave up. */
async function settle(page, extraMs = SETTLE_MS) {
  const notes = [];
  await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => notes.push("load event never fired"));
  const idle = await page
    .waitForLoadState("networkidle", { timeout: streak.idle >= 2 ? 2_000 : 15_000 })
    .then(() => true, () => false);
  streak.idle = idle ? 0 : streak.idle + 1;
  if (!idle) notes.push("network never went idle");
  // app/admin|student/loading.tsx show PageSkeleton (animate-pulse) while a server component streams.
  const skeletonGone = await page
    .waitForFunction(() => !document.querySelector(".animate-pulse"), undefined, { timeout: streak.skeleton >= 2 ? 1_000 : 10_000 })
    .then(() => true, () => false);
  streak.skeleton = skeletonGone ? 0 : streak.skeleton + 1;
  if (!skeletonGone) notes.push("an .animate-pulse element was still on screen");
  await page
    .evaluate(async () => {
      const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
      const pending = [...document.images].filter((img) => !img.complete);
      const loaded = pending.map(
        (img) => new Promise((r) => {
          img.addEventListener("load", r, { once: true });
          img.addEventListener("error", r, { once: true });
        })
      );
      await Promise.race([Promise.all(loaded), timeout(8000)]);
      if (document.fonts) await Promise.race([document.fonts.ready, timeout(5000)]);
    })
    .catch(() => {});
  await page.waitForTimeout(extraMs);
  return notes;
}

/** Routes page events (JS errors, console errors, failed sub-requests) to the capture in progress. */
function attachTracker(page) {
  const tracker = { current: null };
  page.on("pageerror", (err) => tracker.current?.pageErrors.push(clip(err?.message ?? err)));
  page.on("console", (msg) => {
    const e = tracker.current;
    if (e && msg.type() === "error" && e.consoleErrors.length < 4) e.consoleErrors.push(clip(msg.text(), 160));
  });
  page.on("response", (res) => {
    const e = tracker.current;
    if (!e || res.status() < 400 || res.request().resourceType() === "document") return;
    if (e.badResponses.length < 4) e.badResponses.push(`${res.status()} ${shortUrl(res.url())}`);
  });
  page.on("requestfailed", (req) => {
    const e = tracker.current;
    const why = req.failure()?.errorText ?? "failed";
    if (!e || /ERR_ABORTED/.test(why) || e.badResponses.length >= 4) return; // aborted prefetches are normal
    e.badResponses.push(`${why} ${shortUrl(req.url())}`);
  });
  return tracker;
}

async function shoot(page, file, vp, fullPage, entry) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const options = { path: file, type: "jpeg", quality: JPEG_QUALITY, fullPage, animations: "disabled", timeout: 60_000 };
  if (fullPage) {
    const height = await page
      .evaluate(() => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0))
      .catch(() => 0);
    if (height * vp.dsf > MAX_IMAGE_PX) {
      options.scale = "css";
      entry.notes.push(`very tall page (${height}px), captured at 1x`);
    }
  }
  await page.screenshot(options);
}

function newEntry(vp, area, slug, url) {
  return {
    viewport: vp.name, area, slug, name: `${area}-${slug}`, url,
    file: `screenshots/${vp.name}/${area}-${slug}.jpg`,
    status: null, finalUrl: null, captured: false, problems: [], notes: [],
    pageErrors: [], consoleErrors: [], badResponses: [], ms: 0,
  };
}

async function capture(page, tracker, vp, area, spec, results) {
  const entry = newEntry(vp, area, spec.slug, spec.url);
  results.push(entry);
  tracker.current = entry;
  const started = Date.now();
  try {
    const response = await page.goto(BASE_URL + spec.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    entry.status = response ? response.status() : null;
    entry.notes.push(...(await settle(page)));
    if (spec.action) await spec.action(page);
  } catch (err) {
    entry.problems.push(clip(`${err?.name ?? "Error"}: ${err?.message ?? err}`, 300));
  }
  try {
    const final = new URL(page.url());
    entry.finalUrl = final.pathname + final.search;
    const expected = spec.expect ?? [200];
    if (entry.status !== null && !expected.includes(entry.status)) entry.problems.push(`HTTP ${entry.status}`);
    if (area !== "public" && final.pathname.startsWith("/login")) entry.problems.push("redirected to /login");
    const text = await page.evaluate(() => (document.body ? document.body.innerText.slice(0, 20_000) : "")).catch(() => "");
    for (const [re, label] of ERROR_MARKERS) if (re.test(text)) entry.problems.push(label);
    await shoot(page, path.join(OUT, entry.file), vp, spec.fullPage !== false, entry);
    entry.captured = true;
  } catch (err) {
    entry.problems.push(clip(`screenshot failed: ${err?.message ?? err}`, 300));
  }
  if (entry.pageErrors.length) entry.problems.push(`uncaught JS error: ${entry.pageErrors[0]}`);
  entry.ms = Date.now() - started;
  tracker.current = null;
  const state = !entry.captured ? "MISSING" : entry.problems.length ? "FLAGGED" : "ok";
  log(`${vp.name.padEnd(7)} ${entry.name.padEnd(40)} ${String(entry.status ?? "---")} ${state}${entry.problems.length ? " (" + entry.problems.join("; ") + ")" : ""} ${(entry.ms / 1000).toFixed(1)}s`);
  return entry;
}

/** Signs in through the real login form. Returns an error message, or null on success. */
async function login(page, identifier, password, landing) {
  try {
    await page.goto(`${BASE_URL}/login${landing.startsWith("/admin") ? "?role=staff" : ""}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {}); // let React hydrate
    const idInput = page.locator('input[name="identifier"], #identifier').first();
    const pwInput = page.locator('input[name="password"], #password').first();
    await idInput.fill(identifier);
    await pwInput.fill(password);
    const submit = page.locator('form:has(input[name="password"]) [type="submit"]').first();
    const landed = page.waitForURL((u) => u.pathname.startsWith(landing) || u.pathname.startsWith("/change-password"), { timeout: 45_000 });
    const refused = page
      .getByText(/invalid credentials|too many attempts|could not reach|not active/i)
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
    if ((await submit.count()) > 0) await submit.click();
    else await pwInput.press("Enter");
    await Promise.race([landed, refused]);
    landed.catch(() => {});
    refused.catch(() => {});
    const where = new URL(page.url()).pathname;
    if (where.startsWith("/change-password")) return "sent to /change-password (is the seeded password the default Library ID?)";
    if (!where.startsWith(landing)) {
      const shown = await page.getByText(/invalid credentials|too many attempts|could not reach|not active/i).first().textContent().catch(() => "");
      return `stayed on ${where}${shown ? `: "${clip(shown, 120)}"` : ""}`;
    }
    const cookies = await page.context().cookies();
    if (!cookies.some((c) => c.name === "lms_session")) return "landed but no lms_session cookie was set";
    return null;
  } catch (err) {
    return clip(`${err?.name ?? "Error"}: ${err?.message ?? err}`, 300);
  }
}

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */

function gitInfo() {
  const run = (cmd) => {
    try {
      return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      return "";
    }
  };
  const server = process.env.GITHUB_SERVER_URL || "https://github.com";
  const repo = process.env.GITHUB_REPOSITORY || "";
  const sha = process.env.GITHUB_SHA || run("git rev-parse HEAD");
  return {
    branch: process.env.GITHUB_REF_NAME || run("git rev-parse --abbrev-ref HEAD") || "unknown",
    sha: sha || "unknown",
    commitUrl: repo && sha ? `${server}/${repo}/commit/${sha}` : "",
    runUrl: repo && process.env.GITHUB_RUN_ID ? `${server}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "",
    runId: process.env.GITHUB_RUN_ID || "",
  };
}

function renderIndex(meta, ids, results) {
  const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const captured = results.filter((r) => r.captured).length;
  const flagged = results.filter((r) => !r.captured || r.problems.length).length;
  const out = [
    "# UI screenshots",
    "",
    "| | |",
    "|---|---|",
    `| Source branch | \`${meta.branch}\` |`,
    `| Commit | ${meta.commitUrl ? `[\`${meta.sha.slice(0, 7)}\`](${meta.commitUrl})` : `\`${meta.sha.slice(0, 7)}\``} (\`${meta.sha}\`) |`,
    `| Captured (UTC) | ${meta.capturedAt} |`,
    `| Workflow run | ${meta.runUrl ? `[${meta.runId}](${meta.runUrl})` : "local run"} |`,
    `| Result | ${captured} of ${results.length} captured, ${flagged} flagged |`,
    "",
    "Rendered by `next start` against a throwaway MongoDB seeded by `scripts/ui-screenshots/seed.ts`",
    `(the book catalog is the real Sanity dataset). Admin pages are signed in as ${ids.logins.admin.name}`,
    `(\`${ids.logins.admin.email}\` / \`${ids.logins.admin.password}\`), student pages as ${ids.demoStudent.name}`,
    `(\`${ids.demoStudent.libraryId}\` / \`${ids.demoStudent.password}\`). Book detail: ${ids.book.title}.`,
    "",
  ];
  for (const vp of VIEWPORTS) {
    const rows = results.filter((r) => r.viewport === vp.name);
    if (!rows.length) continue;
    out.push(`## ${vp.name} (${vp.label})`, "", "| Page | URL | HTTP | Result | Problems / notes | Screenshot |", "|---|---|---|---|---|---|");
    for (const r of rows) {
      const notes = [
        ...r.problems,
        ...r.notes,
        ...(r.finalUrl && r.finalUrl !== r.url ? [`ended at ${r.finalUrl}`] : []),
        ...r.badResponses.map((b) => `sub-request ${b}`),
        ...r.consoleErrors.map((c) => `console: ${c}`),
      ];
      const result = !r.captured ? "MISSING" : r.problems.length ? "FLAGGED" : "OK";
      out.push(
        `| ${cell(r.name)} | \`${cell(r.url)}\` | ${r.status ?? "-"} | ${result} | ${cell(notes.join("; ")) || " "} | ${r.captured ? `[${cell(path.basename(r.file))}](${r.file})` : "-"} |`
      );
    }
    out.push("");
  }
  return out.join("\n");
}

function serverLogTail() {
  const file = process.env.UI_LOG_DIR ? path.join(process.env.UI_LOG_DIR, "server.log") : "";
  if (!file || !existsSync(file)) return "";
  const text = readFileSync(file, "utf8").replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
  return text.split("\n").slice(-50).join("\n").slice(-5000);
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main() {
  const ids = JSON.parse(await fs.readFile(IDS_FILE, "utf8"));
  const pages = pagesFor(ids);
  const wanted = (name) => ONLY.length === 0 || ONLY.some((o) => name.includes(o));

  const probe = await fetch(`${BASE_URL}/login`).catch((err) => ({ status: `unreachable (${err.message})` }));
  if (probe.status !== 200) throw new Error(`${BASE_URL}/login answered ${probe.status}; is the app running?`);

  await fs.rm(path.join(OUT, "screenshots"), { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const results = [];
  const loginFailures = [];
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        ...vp.context,
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        colorScheme: "light",
        reducedMotion: "reduce",
        serviceWorkers: "block", // public/sw.js would otherwise sit in front of every navigation
      });
      context.setDefaultTimeout(30_000);
      const page = await context.newPage();
      const tracker = attachTracker(page);
      const applies = (area, spec) => (!spec.viewports || spec.viewports.includes(vp.name)) && wanted(`${area}-${spec.slug}`);

      for (const spec of pages.public) if (applies("public", spec)) await capture(page, tracker, vp, "public", spec, results);

      const sessions = [
        { area: "admin", identifier: ids.logins.admin.email, password: ids.logins.admin.password, landing: "/admin" },
        { area: "student", identifier: ids.demoStudent.libraryId, password: ids.demoStudent.password, landing: "/student" },
      ];
      for (const s of sessions) {
        const specs = pages[s.area].filter((spec) => applies(s.area, spec));
        if (!specs.length) continue;
        await context.clearCookies(); // "sign out" of whoever was signed in before
        const failure = await login(page, s.identifier, s.password, s.landing);
        if (failure) {
          log(`${vp.name} ${s.area} login FAILED: ${failure}`);
          loginFailures.push(`${vp.name} ${s.area}: ${failure}`);
          const entry = newEntry(vp, s.area, "login-failed", "/login");
          entry.problems.push(`login as ${s.identifier} failed: ${failure}`);
          results.push(entry);
          await shoot(page, path.join(OUT, entry.file), vp, true, entry).then(() => (entry.captured = true)).catch(() => {});
          for (const spec of specs) {
            const skipped = newEntry(vp, s.area, spec.slug, spec.url);
            skipped.problems.push("skipped: not signed in");
            results.push(skipped);
          }
          continue;
        }
        log(`${vp.name} signed in as ${s.identifier}`);
        for (const spec of specs) await capture(page, tracker, vp, s.area, spec, results);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const meta = { ...gitInfo(), capturedAt: new Date().toISOString().replace("T", " ").slice(0, 19) };
  await fs.writeFile(path.join(OUT, "index.md"), renderIndex(meta, ids, results) + "\n");
  await fs.writeFile(path.join(OUT, "results.json"), JSON.stringify({ meta, results }, null, 2));

  const captured = results.filter((r) => r.captured);
  const flagged = results.filter((r) => !r.captured || r.problems.length);
  const perViewport = VIEWPORTS.map((vp) => `${vp.name} ${captured.filter((r) => r.viewport === vp.name).length}`).join(", ");
  const summary =
    `Captured ${captured.length} of ${results.length} screenshots (${perViewport}); ${flagged.length} flagged` +
    (flagged.length ? `: ${flagged.map((r) => `${r.viewport}/${r.name} (${r.problems[0] ?? "missing"})`).join("; ")}` : ".");
  log(summary);
  log(`index: ${path.join(OUT, "index.md")}`);
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::notice title=UI screenshots::${esc(clip(summary, 3000))}`);
    for (const r of flagged.slice(0, 7)) {
      const detail = [`HTTP ${r.status ?? "-"}`, ...r.problems.filter((p) => p !== `HTTP ${r.status}`), ...r.notes,
        ...r.badResponses.map((b) => `sub-request ${b}`), ...r.consoleErrors.map((c) => `console: ${c}`)];
      console.log(`::warning title=${escProp(`${r.viewport}/${r.name} ${r.url}`)}::${esc(detail.join("\n").slice(0, 2000))}`);
    }
    // The server log explains crashes; a plain 404 (e.g. /catalog before it exists) needs no log.
    const crashed = flagged.some((r) => !r.captured || r.problems.some((p) => !/^HTTP 404$/.test(p)));
    const tail = crashed ? serverLogTail() : "";
    if (tail) console.log(`::warning title=next start log (tail)::${esc(tail)}`);
  }

  if (captured.length === 0) throw new Error("no screenshots were captured");
  if (loginFailures.length) throw new Error(`login failed: ${loginFailures.join(" | ")}`);
}

main().catch((err) => {
  console.error(`[capture] FAILED: ${err?.stack ?? err}`);
  process.exit(1);
});
