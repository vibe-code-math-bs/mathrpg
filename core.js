/* ===== CORE.JS =====
   Load/save, export/import, decay, router, shared helpers.
   Phase A scope: state schema + loadState/saveState + decay-on-load + router between
   screens (most still placeholders) + navigator.storage.persist().
   Phase B adds the glyph builder here.
*/

const STORAGE_KEY = "mathrpg.state.v1";

/* ---------- Pinned formulas (mathrpg-build-plan.md §3) ---------- */

const TIER_WEIGHTS = { gre: 0.8, undergrad: 1.0, graduate: 1.5, research: 2.0 };
const TIER_LABELS = { gre: "GRE / review", undergrad: "Undergrad", graduate: "Graduate", research: "Research" };

const UNIT_BASE_XP = { notes: 10, exercise: 10, experiment: 15, exposition: 15 };

const UNIT_STAT_MAP = {
  notes: ["literature", "abstraction"],
  exercise: ["technique", "rigor"],
  experiment: ["intuition", "abstraction"],
  exposition: ["exposition", "abstraction"]
};

const STAT_GRANT_PER_UNIT = 10;

// XP to go from level n -> n+1 for a single skill's mastery curve: 100 * (n+1)
// Given cumulative masteryXP, find the mastery level + progress to next.
function masteryLevelFromXP(xp) {
  let level = 0;
  let consumed = 0;
  while (true) {
    const need = 100 * (level + 1);
    if (consumed + need > xp) break;
    consumed += need;
    level++;
  }
  return { level: level, xpIntoLevel: xp - consumed, xpForNextLevel: 100 * (level + 1) };
}

// Overall level curve: L -> L+1 = 250 * (L+1)
function overallLevelFromXP(xp) {
  let level = 0;
  let consumed = 0;
  while (true) {
    const need = 250 * (level + 1);
    if (consumed + need > xp) break;
    consumed += need;
    level++;
  }
  return { level: level, xpIntoLevel: xp - consumed, xpForNextLevel: 250 * (level + 1) };
}

// Class level curve: L -> L+1 = 150 * (L+1)
function classLevelFromXP(xp) {
  let level = 0;
  let consumed = 0;
  while (true) {
    const need = 150 * (level + 1);
    if (consumed + need > xp) break;
    consumed += need;
    level++;
  }
  return { level: level, xpIntoLevel: xp - consumed, xpForNextLevel: 150 * (level + 1) };
}

// Titles are user-selected, not level-unlocked (explicit correction — Level and Title
// are deliberately decoupled: real-life standing doesn't move in lockstep with in-app
// XP). state.currentTitle holds whichever ladder entry the user picked in Character's
// title picker; this just reads it with a safe fallback to the ladder's first rank.
function getCurrentTitle(state) {
  const ladder = state.titlesLadder || SEED_TITLES_LADDER;
  return (state.currentTitle && ladder.indexOf(state.currentTitle) !== -1) ? state.currentTitle : ladder[0];
}

/* ---------- Branch labels (skills-seed.md branch keys -> display names) ---------- */

const BRANCH_LABELS = {
  algebra: "Algebra",
  topology: "Topology",
  analysis: "Analysis",
  "number-theory": "Number Theory",
  foundations: "Foundations / GRE",
  diagrammatic: "Diagrammatic Algebra",
  "math-physics": "Math Physics"
};

/* ---------- Skill glyph builder (design spec §5) ----------
   Shared primitive: Skills, Today, Quests, Character all reuse this.
     ring  = Level    (track + arc, length = `fraction`, 0..1)
     disc  = Mastery  (radius 6-13px / opacity 0.3-0.7, scales with `masteryDepth` 0..1)
     hatch = Rust      (3 diagonal strokes, only when `rusting`)
     text  = `numeral` centered
   Per the design spec's required bugfix: the arc is rotated via the SVG `transform`
   attribute (not CSS transform+transform-origin), paired with pathLength="100" so
   stroke-dasharray is a plain 0-100 percentage. */

function clamp01(n) {
  return Math.max(0, Math.min(1, n || 0));
}

function buildSkillGlyph(opts) {
  opts = opts || {};
  const size = opts.size || 44;
  const fraction = clamp01(opts.fraction);
  const arcLen = (fraction * 100).toFixed(1);
  const numeral = (opts.numeral === undefined || opts.numeral === null) ? "" : opts.numeral;
  const showMastery = opts.showMastery !== false;
  // Ring at max (every roadmap subtopic done) reads as a small win — arc turns
  // celadon instead of chalk-white so a maxed skill is legible at a glance.
  const arcColor = fraction >= 1 ? "var(--celadon)" : "var(--chalk)";

  let inner = "";
  if (showMastery) {
    const depth = clamp01(opts.masteryDepth);
    const radius = 6 + depth * 7;
    const opacity = 0.3 + depth * 0.4;
    const fill = opts.active ? "var(--celadon)" : "var(--amber)";
    inner += '<circle cx="22" cy="22" r="' + radius.toFixed(1) + '" fill="' + fill + '" opacity="' + opacity.toFixed(2) + '"/>';
  }
  if (opts.rusting) {
    inner += '<g stroke="var(--rust)" stroke-width="1" opacity="0.75">' +
      '<path d="M14 14 L30 30 M18 12 L32 26 M12 18 L26 32"/></g>';
  }

  return (
    '<svg viewBox="0 0 44 44" width="' + size + '" height="' + size + '" class="skill-glyph" aria-hidden="true">' +
    '<circle cx="22" cy="22" r="18" fill="none" stroke="var(--rule)" stroke-width="2.5" pathLength="100"/>' +
    '<circle cx="22" cy="22" r="18" fill="none" stroke="' + arcColor + '" stroke-width="2.5" ' +
    'stroke-linecap="round" pathLength="100" stroke-dasharray="' + arcLen + ' 100" transform="rotate(-90 22 22)"/>' +
    inner +
    '<text x="22" y="26" text-anchor="middle" font-family="STIX Two Text, serif" font-size="14" ' +
    'font-weight="600" fill="var(--chalk)">' + numeral + '</text>' +
    '</svg>'
  );
}

// Mastery "depth" (0..1) drives disc radius/opacity — normalized against a soft level-10 cap.
function masteryDepthFromXP(xp) {
  return clamp01(masteryLevelFromXP(xp).level / 10);
}

function isSkillRusting(state, skill) {
  if (!skill.maintenance || !skill.lastTouched) return false;
  const graceMs = (state.settings.graceWindowDays || 7) * 24 * 60 * 60 * 1000;
  return (Date.now() - skill.lastTouched) > graceMs;
}

// Convenience wrapper: build a skill's full glyph straight from its state object.
// fraction = Level / roadmap length (subtopics cleared); numeral = Level.
function skillGlyphForSkill(state, skill, opts) {
  opts = opts || {};
  const maxLevel = (skill.roadmap && skill.roadmap.length) || 1;
  return buildSkillGlyph({
    size: opts.size,
    fraction: skill.level / maxLevel,
    numeral: skill.level,
    masteryDepth: masteryDepthFromXP(skill.masteryXP),
    active: !!opts.active,
    rusting: isSkillRusting(state, skill),
    showMastery: opts.showMastery
  });
}

/* ---------- State construction ---------- */

function freshState() {
  return {
    version: 1,
    lifetimeXP: 0,
    classXP: { math: 0, physics: 0 },
    titlesLadder: SEED_TITLES_LADDER.slice(),
    currentTitle: SEED_TITLES_LADDER[0],
    counters: { exercises: 0, notes: 0, experiments: 0, exposition: 0, papersRead: 0, totalUnits: 0, notePages: 0 },
    dailyActivity: {},
    stats: { technique: 0, rigor: 0, abstraction: 0, intuition: 0, exposition: 0, literature: 0 },
    skills: JSON.parse(JSON.stringify(SEED)),
    sources: JSON.parse(JSON.stringify(SEED_SOURCES)),
    foci: JSON.parse(JSON.stringify(SEED_FOCI)),
    bounties: JSON.parse(JSON.stringify(SEED_BOUNTIES)),
    campaign: JSON.parse(JSON.stringify(SEED_CAMPAIGN)),
    log: [],
    settings: { decayRatePerWeek: 0.02, graceWindowDays: 7 }
  };
}

/* ---------- Load / save ---------- */

let _state = null;

function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error("localStorage unavailable:", e);
  }
  if (raw) {
    try {
      _state = JSON.parse(raw);
    } catch (e) {
      console.error("Saved state was corrupt, reinitializing from seed:", e);
      _state = freshState();
    }
  } else {
    _state = freshState();
  }
  applyDecay(_state);
  saveState();
  return _state;
}

function saveState() {
  if (!_state) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch (e) {
    console.error("Failed to save state:", e);
    alert("Couldn't save — your browser storage may be full or blocked.");
  }
}

function getState() {
  return _state;
}

/* ---------- Decay (mathrpg-build-plan.md §3 / handoff §2) ----------
   Maintenance skills only. If now - lastTouched > grace window, bleed
   ~decayRatePerWeek of current masteryXP per idle week, floored so a single
   tick can never drop the skill below its current mastery-level threshold.
   Lifetime XP / class XP / Level / Stats are never touched here. */

function applyDecay(state) {
  const now = Date.now();
  const graceMs = (state.settings.graceWindowDays || 7) * 24 * 60 * 60 * 1000;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const rate = state.settings.decayRatePerWeek || 0.02;

  state.skills.forEach(function (skill) {
    if (!skill.maintenance) return;
    if (!skill.lastTouched) return; // never logged yet — nothing to decay from
    const idleMs = now - skill.lastTouched;
    if (idleMs <= graceMs) return;

    const idleWeeks = (idleMs - graceMs) / weekMs;
    if (idleWeeks <= 0) return;

    // Floor: never drop below the XP threshold of the skill's current mastery level.
    const floorInfo = masteryLevelFromXP(skill.masteryXP);
    const floorXP = skill.masteryXP - floorInfo.xpIntoLevel;

    const bleed = skill.masteryXP * rate * idleWeeks;
    skill.masteryXP = Math.max(floorXP, skill.masteryXP - bleed);
  });
}

/* ---------- Export / Import / Reset (Settings, Phase A) ---------- */

function exportStateToFile() {
  const data = JSON.stringify(_state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = "mathrpg-backup-" + stamp + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importStateFromFile(file, onDone) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.skills)) {
        throw new Error("File doesn't look like a MathRPG backup.");
      }
      _state = parsed;
      saveState();
      if (onDone) onDone(true, null);
    } catch (err) {
      if (onDone) onDone(false, err.message);
    }
  };
  reader.onerror = function () {
    if (onDone) onDone(false, "Couldn't read that file.");
  };
  reader.readAsText(file);
}

function resetState(onDone) {
  _state = freshState();
  saveState();
  if (onDone) onDone();
}

/* ---------- Storage durability ---------- */

function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () { /* best effort */ });
  }
}

/* ---------- Router ---------- */

const SCREENS = ["today", "skills", "quests", "character", "settings"];
const SCREEN_SUBTITLES = {
  today: "today",
  skills: "skill tree",
  quests: "quests",
  character: "character",
  settings: "settings"
};
const SCREEN_RENDERERS = {
  today: function () { return (typeof renderToday === "function") ? renderToday() : placeholderScreen("Today", "D"); },
  skills: function () { return (typeof renderSkills === "function") ? renderSkills() : placeholderScreen("Skills", "C"); },
  quests: function () { return (typeof renderQuests === "function") ? renderQuests() : placeholderScreen("Quests", "F"); },
  character: function () { return (typeof renderCharacter === "function") ? renderCharacter() : placeholderScreen("Character", "E"); },
  settings: function () { return (typeof renderSettings === "function") ? renderSettings() : placeholderScreen("Settings", "A"); }
};

let _currentScreen = "today";

function placeholderScreen(label, phase) {
  const div = document.createElement("div");
  div.className = "placeholder-screen";
  div.innerHTML =
    '<p class="placeholder-eyebrow">coming soon</p>' +
    '<p class="placeholder-title">' + label + '</p>' +
    '<p class="placeholder-sub">Built in Phase ' + phase + '.</p>';
  return div;
}

function navigate(screenName) {
  if (SCREENS.indexOf(screenName) === -1) return;
  _currentScreen = screenName;

  const main = document.getElementById("main");
  main.innerHTML = "";
  main.appendChild(SCREEN_RENDERERS[screenName]());

  const subtitle = document.getElementById("topbar-subtitle");
  if (subtitle) subtitle.textContent = SCREEN_SUBTITLES[screenName];

  document.querySelectorAll(".tab-item").forEach(function (el) {
    el.classList.toggle("active", el.dataset.screen === screenName);
  });

  // Settings has no tab slot (reached via gear) — clear tab active state for it.
  if (screenName === "settings") {
    document.querySelectorAll(".tab-item").forEach(function (el) {
      el.classList.remove("active");
    });
  }

  window.scrollTo(0, 0);
}

// Re-renders whichever screen is currently active, without changing tabs.
// Used by the Log fan-out (mathrpg-build-plan.md §4 step 13) so screens reflect
// new state immediately once they're built (Phases C-F); harmless no-op against
// placeholders in the meantime.
function refreshCurrentScreen() {
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = "";
  main.appendChild(SCREEN_RENDERERS[_currentScreen]());
}

function initRouter() {
  document.querySelectorAll(".tab-item[data-screen]").forEach(function (el) {
    el.addEventListener("click", function () {
      navigate(el.dataset.screen);
    });
  });
  const gear = document.getElementById("settings-gear");
  if (gear) gear.addEventListener("click", function () { navigate("settings"); });

  const logBtn = document.getElementById("log-button");
  if (logBtn) {
    logBtn.addEventListener("click", function () {
      if (typeof openLogModal === "function") {
        openLogModal();
      } else {
        navigate("today"); // Log modal lands in Phase B
      }
    });
  }

  navigate("today");
}

/* ---------- Misc shared helpers ---------- */

function formatDateISO(d) {
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return formatDateISO(new Date());
}

function daysAgo(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

function skillById(state, id) {
  return state.skills.find(function (s) { return s.id === id; });
}

document.addEventListener("DOMContentLoaded", function () {
  loadState();
  requestPersistentStorage();
  initRouter();
});
