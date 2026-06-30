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

function titleForLevel(state, level) {
  const ladder = state.titlesLadder || SEED_TITLES_LADDER;
  // Simple BUILD CHOICE: one title rank every 3 overall levels, capped at ladder length.
  const idx = Math.min(ladder.length - 1, Math.floor(level / 3));
  return ladder[idx];
}

/* ---------- State construction ---------- */

function freshState() {
  return {
    version: 1,
    lifetimeXP: 0,
    classXP: { math: 0, physics: 0 },
    titlesLadder: SEED_TITLES_LADDER.slice(),
    counters: { exercises: 0, notes: 0, experiments: 0, exposition: 0, papersRead: 0, totalUnits: 0 },
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
