vibe coded bullshit for self-use.

# MathRPG

A character sheet for a working mathematician — a personal, single-user life-RPG that
tracks a real math skill tree (Level = syllabus progress, Mastery = grind XP that can
rust), transferable work-mode Stats, and a handful of live projects and quests.

Multi-file static site. No build step, no framework, no account, no network calls for
data. Everything lives in your browser's `localStorage`. **Export a backup from
Settings regularly** — it's your only safety net against a cleared browser.

The build is complete (Phases A–G). See the comment block at the top of `index.html`
for the full build history if you're picking this back up for further changes.

---

## Running it locally

No install, no server required — just open `index.html` directly in a browser
(`file://` works; the JS is loaded as plain `<script src>` tags, not ES modules, for
exactly this reason).

If you'd rather serve it (some browsers are stricter about `file://`), any static
file server works, e.g. from this folder:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

---

## Deploying to GitHub Pages

Click-by-click, assuming you don't already have a GitHub account/repo for this:

1. **Create a repository.** On github.com, click **New repository**. Name it anything
   (e.g. `mathrpg`). Public or private both work with GitHub Pages on a free account
   (private repos need GitHub Pro/Team/Enterprise for Pages — if you're on a free
   personal account, make it **public**). Don't initialize with a README — you already
   have one.
2. **Upload the files.** Easiest path without installing git: on the new repo's page,
   click **uploading an existing file**, then drag in all 13 files from this folder —
   `index.html`, `styles.css`, `seed.js`, `core.js`, `log.js`, `today.js`, `skills.js`,
   `quests.js`, `character.js`, `settings.js`, `manifest.webmanifest`, `icon-192.png`,
   `icon-512.png` — and commit. (If you're comfortable with git, `git init`, `git add
   .`, `git commit`, `git remote add origin <url>`, `git push` works the same way.)
   They need to sit at the **repo root**, not in a subfolder — the `<script src>` /
   `<link href>` paths in `index.html` are relative (`styles.css`, not `/styles.css`
   or `./mathrpg/styles.css`).
3. **Turn on Pages.** In the repo, go to **Settings → Pages** (left sidebar, under
   "Code and automation"). Under **Build and deployment → Source**, choose **Deploy
   from a branch**. Under **Branch**, pick `main` (or whatever your default branch is
   called) and folder `/ (root)`, then **Save**.
4. **Wait ~1 minute, then find the URL.** Reload Settings → Pages; a banner appears at
   the top reading "Your site is live at `https://<username>.github.io/<repo-name>/`."
   That's your app's permanent URL.
5. **Install it on your phone.** Open that URL in Chrome on Android, tap the **⋮**
   menu → **Add to Home screen**. Because of the `manifest.webmanifest` +
   `apple-mobile-web-app-capable` meta tags already in `index.html`, it opens
   chromeless (no browser chrome) like a real installed app. On iOS Safari, the
   equivalent is Share → **Add to Home Screen**.

**Updating later:** any time you (or Claude, in a future session) change a file,
re-upload it via the same "Upload files" flow (or `git push` if you're using git) —
Pages redeploys automatically within a minute or two, no separate build step.

**Note on `localStorage` scope:** your data is tied to the *browser + device +
origin* (the `github.io` URL), not your GitHub account. It won't sync between your
phone and laptop, and switching browsers on the same phone starts fresh. Export a
backup from Settings before you ever clear site data, switch browsers, or get a new
phone, and Import it on the new one.

---

## File tree

| File | Purpose |
|---|---|
| `index.html` | Shell markup, script/link includes, manifest link, build-progress log |
| `styles.css` | Design tokens (`:root`) + all CSS, shared chrome, all 5 screens |
| `seed.js` | The `SEED` skill tree, sources, foci, bounties, campaign, titles ladder |
| `core.js` | State load/save, export/import/reset, decay, router, skill-glyph builder |
| `log.js` | The Log modal + the XP/Mastery/Stats write fan-out + reward beat |
| `today.js` | Today screen — heatmap, streak, XP strip, foci due, rust alerts, daily haul |
| `skills.js` | Skills screen — branch grid, Skill Detail (roadmap, Mastery, history) |
| `quests.js` | Quests screen — Bigelow Campaign, Bosses, Foci, Bounty board |
| `character.js` | Character screen — identity, levels, Stats radar, lifetime counters |
| `settings.js` | Settings screen — backup, sources/tiers, decay tuning, reset |
| `manifest.webmanifest` + `icon-*.png` | PWA install metadata |
