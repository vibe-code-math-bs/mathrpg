/* ===== TODAY.JS =====
   Phase D: the operational "what do I do now" surface (handoff §9 ①, design spec §7).
   Top to bottom: activity heatmap, date hero, streak dots, XP strip, foci due now,
   rust alerts (only rendered when something is actually rusting), today's logged
   units, daily-haul callout.

   Small helpers (escapeHtml/capitalize) are duplicated here rather than imported from
   skills.js/log.js, per build-plan §1's one-file-per-screen convention — every screen
   file stays self-contained rather than depending on load order between screen files.
   Everything else used below (isSkillRusting, skillGlyphForSkill, buildSkillGlyph,
   masteryLevelFromXP, overallLevelFromXP, formatDateISO/todayISO/daysAgo/skillById) is
   genuinely shared and already lives in core.js. */

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- Screen: Today ---------- */

function renderToday() {
  var state = getState();
  var wrap = document.createElement("div");
  wrap.className = "today-wrap";

  wrap.appendChild(renderHeatmapCard(state));
  wrap.appendChild(renderDateHero());
  wrap.appendChild(renderStreakRow(state));
  wrap.appendChild(renderXPStrip(state));
  wrap.appendChild(renderFociCard(state));

  var rustCard = renderRustCard(state);
  if (rustCard) wrap.appendChild(rustCard);

  wrap.appendChild(renderLoggedUnitsCard(state));
  wrap.appendChild(renderHaulBox(state));

  return wrap;
}

/* ---------- ① Activity heatmap ----------
   GitHub-style contribution grid, rolling 53 weeks (Sun-Sat columns), one square per
   day. Squares darken with that day's summed dailyActivity weight (tier-weight x
   quantity, written by log.js's fan-out step 7) through empty -> celadon-dim ->
   celadon -> amber-dim -> amber (design spec §7①). Horizontally scrollable; auto-
   scrolls to today (the right edge) on render. */

var HEATMAP_WEEKS = 53;

function heatmapLevel(value) {
  if (!value || value <= 0) return 0;
  if (value <= 1.5) return 1;
  if (value <= 3) return 2;
  if (value <= 6) return 3;
  return 4;
}

function buildHeatmapWeeks(state) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var endSunday = new Date(today);
  endSunday.setDate(today.getDate() - today.getDay());
  var startSunday = new Date(endSunday);
  startSunday.setDate(endSunday.getDate() - (HEATMAP_WEEKS - 1) * 7);

  var weeks = [];
  for (var w = 0; w < HEATMAP_WEEKS; w++) {
    var week = [];
    for (var d = 0; d < 7; d++) {
      var day = new Date(startSunday);
      day.setDate(startSunday.getDate() + w * 7 + d);
      var iso = formatDateISO(day);
      week.push({
        date: day,
        iso: iso,
        value: state.dailyActivity[iso] || 0,
        isFuture: day > today,
        isToday: iso === formatDateISO(today)
      });
    }
    weeks.push(week);
  }
  return weeks;
}

function renderHeatmapCard(state) {
  var card = document.createElement("div");
  card.className = "card heatmap-card";

  var header = document.createElement("p");
  header.className = "card-header small-caps";
  header.textContent = "Activity";
  card.appendChild(header);

  var weeks = buildHeatmapWeeks(state);

  var scroll = document.createElement("div");
  scroll.className = "heatmap-scroll";

  // Month labels: one per week-column, text only where a new month starts within
  // that week's Sunday; overflows rightward into blank neighboring cells (GitHub's
  // own trick) rather than trying to hand-measure text width.
  var months = document.createElement("div");
  months.className = "heatmap-months";
  var lastMonth = null;
  weeks.forEach(function (week) {
    var label = document.createElement("span");
    label.className = "heatmap-month-label";
    var m = week[0].date.getMonth();
    if (week[0].date.getDate() <= 7 && m !== lastMonth) {
      label.textContent = week[0].date.toLocaleDateString(undefined, { month: "short" });
      lastMonth = m;
    }
    months.appendChild(label);
  });
  scroll.appendChild(months);

  var grid = document.createElement("div");
  grid.className = "heatmap-grid";
  weeks.forEach(function (week) {
    week.forEach(function (day) {
      var cell = document.createElement("div");
      cell.className = "heatmap-day";
      if (day.isFuture) {
        cell.classList.add("is-future");
      } else {
        cell.classList.add("lvl" + heatmapLevel(day.value));
      }
      if (day.isToday) cell.classList.add("is-today");
      cell.title = day.iso + (day.value ? " \u2014 activity " + day.value.toFixed(1) : "");
      grid.appendChild(cell);
    });
  });
  scroll.appendChild(grid);
  card.appendChild(scroll);

  var caption = document.createElement("p");
  caption.className = "heatmap-caption small-caps";
  caption.textContent = "don\u2019t break the chain";
  card.appendChild(caption);

  // Scroll to the right edge (today) once this card is actually in the document —
  // scrollWidth isn't meaningful until after navigate() appends the returned node.
  setTimeout(function () { scroll.scrollLeft = scroll.scrollWidth; }, 0);

  return card;
}

/* ---------- ② Date hero ---------- */

function renderDateHero() {
  var hero = document.createElement("div");
  hero.className = "date-hero";
  var now = new Date();

  var eyebrow = document.createElement("p");
  eyebrow.className = "date-hero-eyebrow small-caps";
  eyebrow.textContent = now.toLocaleDateString(undefined, { weekday: "long" });
  hero.appendChild(eyebrow);

  var dateP = document.createElement("p");
  dateP.className = "date-hero-date";
  dateP.textContent = now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  hero.appendChild(dateP);

  return hero;
}

/* ---------- ③ Streak row ----------
   Current calendar week, Sun-Sat: filled amber = logged that day, outlined celadon
   ring = today, empty rule-bordered = everything else (future days, or past days with
   no activity — the design spec names three states and a quiet past day reads the
   same as a not-yet-arrived one). Caption below carries the actual streak count,
   computed separately over unbounded history, not just this displayed week. */

function computeStreak(state) {
  var oneDay = 24 * 60 * 60 * 1000;
  var cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // If today has no activity yet, don't let an unfinished day zero out the streak —
  // start counting from yesterday instead.
  if (!(state.dailyActivity[formatDateISO(cursor)] > 0)) {
    cursor = new Date(cursor.getTime() - oneDay);
  }
  var streak = 0;
  while (state.dailyActivity[formatDateISO(cursor)] > 0) {
    streak++;
    cursor = new Date(cursor.getTime() - oneDay);
  }
  return streak;
}

function renderStreakRow(state) {
  var wrap = document.createElement("div");

  var row = document.createElement("div");
  row.className = "streak-row";

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  var todayIso = formatDateISO(today);

  for (var d = 0; d < 7; d++) {
    var day = new Date(sunday);
    day.setDate(sunday.getDate() + d);
    var iso = formatDateISO(day);
    var dot = document.createElement("span");
    dot.className = "streak-dot";
    if (iso === todayIso) {
      dot.classList.add("today-ring");
    } else if (day < today && state.dailyActivity[iso] > 0) {
      dot.classList.add("filled");
    }
    row.appendChild(dot);
  }
  wrap.appendChild(row);

  var streak = computeStreak(state);
  var caption = document.createElement("p");
  caption.className = "streak-caption small-caps";
  caption.textContent = streak > 0
    ? streak + "-day streak \u2014 keep the chalk moving"
    : "no active streak \u2014 log something to start one";
  wrap.appendChild(caption);

  return wrap;
}

/* ---------- ④ XP strip ----------
   Reuses the Level-ring half of the shared skill glyph (buildSkillGlyph directly,
   showMastery:false) against the Character overall-level curve — not a per-skill one,
   so this deliberately doesn't go through skillGlyphForSkill(). */

function renderXPStrip(state) {
  var card = document.createElement("div");
  card.className = "card xp-strip";

  var info = overallLevelFromXP(state.lifetimeXP);
  var glyphWrap = document.createElement("div");
  glyphWrap.innerHTML = buildSkillGlyph({
    size: 52,
    fraction: info.xpForNextLevel ? (info.xpIntoLevel / info.xpForNextLevel) : 0,
    numeral: info.level,
    showMastery: false
  });
  card.appendChild(glyphWrap);

  var text = document.createElement("div");
  text.className = "xp-strip-text";
  text.innerHTML =
    '<p class="xp-strip-level">Character Level ' + info.level + '</p>' +
    '<p class="xp-strip-sub small-caps">' + info.xpIntoLevel + ' / ' + info.xpForNextLevel +
    ' xp to Level ' + (info.level + 1) + '</p>';
  card.appendChild(text);

  return card;
}

/* ---------- ⑤ Foci due now ----------
   Each row doubles as its own quick-log shortcut (handoff §9①'s "quick-log shortcuts
   for whatever's due") — tapping Log opens the Log modal prefilled with that focus's
   skill + default unit type (log.js's openLogModal(prefill), added this phase). */

var FOCUS_CADENCE_DAYS = { daily: 1, "semi-weekly": 3.5, weekly: 7, custom: 7 };

function focusState(focus) {
  if (!focus.lastMet) return "due";
  var cadenceMs = (FOCUS_CADENCE_DAYS[focus.cadence] || 7) * 24 * 60 * 60 * 1000;
  return (Date.now() - focus.lastMet) < cadenceMs ? "met" : "due";
}

function renderFociCard(state) {
  var card = document.createElement("div");
  card.className = "card";
  var header = document.createElement("p");
  header.className = "card-header small-caps";
  header.textContent = "Foci due now";
  card.appendChild(header);

  var active = state.foci.filter(function (f) { return f.active; });
  if (!active.length) {
    var empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No active foci \u2014 add one in Quests.";
    card.appendChild(empty);
    return card;
  }

  active.forEach(function (focus) {
    card.appendChild(renderFocusRow(state, focus));
  });

  return card;
}

function renderFocusRow(state, focus) {
  var skill = skillById(state, focus.skillId);
  var row = document.createElement("div");
  row.className = "focus-row";

  if (skill) {
    var glyphWrap = document.createElement("div");
    glyphWrap.innerHTML = skillGlyphForSkill(state, skill, { size: 40, active: true });
    row.appendChild(glyphWrap);
  }

  var left = document.createElement("div");
  left.className = "focus-row-left";
  var st = focusState(focus);
  left.innerHTML =
    '<p class="focus-name">' + escapeHtml(focus.name) +
    ' <span class="focus-state state-' + st + ' small-caps">' + st + '</span></p>' +
    '<p class="focus-sub small-caps">' + (skill ? escapeHtml(skill.name) + " \u00b7 " : "") +
    escapeHtml(focus.cadence) + (focus.streak ? " \u00b7 streak " + focus.streak : "") + '</p>' +
    (focus.note ? '<p class="focus-note">' + escapeHtml(focus.note) + '</p>' : '');
  row.appendChild(left);

  var logBtn = document.createElement("button");
  logBtn.type = "button";
  logBtn.className = "btn quick-log-btn";
  logBtn.textContent = "Log";
  logBtn.addEventListener("click", function () {
    if (typeof openLogModal === "function") {
      openLogModal({ unitType: focus.defaultUnitType, skillId: focus.skillId });
    }
  });
  row.appendChild(logBtn);

  return row;
}

/* ---------- ⑥ Rust alerts (the whole card is omitted when nothing is rusting) ---------- */

function renderRustCard(state) {
  var rusting = state.skills.filter(function (s) { return isSkillRusting(state, s); });
  if (!rusting.length) return null;

  var card = document.createElement("div");
  card.className = "card";
  var header = document.createElement("p");
  header.className = "card-header small-caps";
  header.textContent = "Rust alerts";
  card.appendChild(header);

  rusting.forEach(function (skill) {
    var row = document.createElement("div");
    row.className = "rust-row";
    row.innerHTML =
      skillGlyphForSkill(state, skill, { size: 36, active: false }) +
      '<span class="rust-row-text small-caps">' + escapeHtml(skill.name) +
      ' \u2014 rusting, last touched ' + daysAgo(skill.lastTouched) + ' days ago</span>';
    card.appendChild(row);
  });

  return card;
}

/* ---------- ⑦ Today's logged units ----------
   A record of what's already been banked today, not a to-do list — every row is a
   completed rep, hence the checkbox always renders filled/checked (design spec §7⑦'s
   "pending" state has nothing to attach to without an invented daily quota system). */

function renderLoggedUnitsCard(state) {
  var card = document.createElement("div");
  card.className = "card";
  var header = document.createElement("p");
  header.className = "card-header small-caps";
  header.textContent = "Today's logged units";
  card.appendChild(header);

  var iso = todayISO();
  var entries = state.log
    .filter(function (e) { return formatDateISO(new Date(e.ts)) === iso; })
    .slice()
    .sort(function (a, b) { return b.ts - a.ts; });

  if (!entries.length) {
    var empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Nothing logged yet today \u2014 tap \u2295 Log to start.";
    card.appendChild(empty);
    return card;
  }

  entries.forEach(function (entry) {
    var skill = skillById(state, entry.skillId);
    var source = state.sources.find(function (s) { return s.id === entry.sourceId; });
    var row = document.createElement("div");
    row.className = "unit-row";
    row.innerHTML =
      '<span class="unit-checkbox" aria-hidden="true">\u2713</span>' +
      '<div class="unit-row-text">' +
      '<p class="unit-row-name">' + (skill ? escapeHtml(skill.name) : "Unknown skill") +
      ' \u2014 ' + capitalize(entry.unitType) + '</p>' +
      '<p class="unit-row-sub small-caps">' + (source ? escapeHtml(source.name) : "") +
      (entry.quantity && entry.quantity !== 1 ? " \u00b7 \u00d7" + entry.quantity : "") + '</p>' +
      '</div>' +
      '<span class="unit-row-xp">+' + entry.xpGranted + '</span>';
    card.appendChild(row);
  });

  return card;
}

/* ---------- ⑧ Daily haul callout ----------
   The handoff's example line ("+45 lifetime XP · +20 Technique · 1 subtopic cleared ·
   streak 6") includes a "subtopics cleared today" count that isn't representable with
   the current data model — roadmap checks (skills.js) carry no timestamp, only a
   done:true/false flag, so there's no way to tell which day a subtopic was cleared.
   Substituting a trackable "units logged" count instead keeps the same spirit ("a
   day's scattered logging gets to feel like an amount") without fabricating a number. */

function renderHaulBox(state) {
  var iso = todayISO();
  var entries = state.log.filter(function (e) { return formatDateISO(new Date(e.ts)) === iso; });

  var box = document.createElement("div");
  box.className = "haul-box";

  var label = document.createElement("p");
  label.className = "haul-label small-caps";
  label.textContent = "Today\u2019s haul";
  box.appendChild(label);

  var line = document.createElement("p");
  line.className = "haul-line";
  var streak = computeStreak(state);

  if (!entries.length) {
    line.textContent = "Nothing logged yet \u2014 current streak " + streak + ". Tap \u2295 Log to get started.";
  } else {
    var totalXp = 0, unitsCount = 0, statsTotals = {};
    entries.forEach(function (e) {
      totalXp += e.xpGranted;
      unitsCount += (e.quantity || 1);
      Object.keys(e.statsGranted || {}).forEach(function (k) {
        statsTotals[k] = (statsTotals[k] || 0) + e.statsGranted[k];
      });
    });
    var topStat = null, topAmt = 0;
    Object.keys(statsTotals).forEach(function (k) {
      if (statsTotals[k] > topAmt) { topAmt = statsTotals[k]; topStat = k; }
    });

    var parts = ["+" + totalXp + " lifetime xp"];
    if (topStat) parts.push("+" + topAmt + " " + capitalize(topStat));
    parts.push(unitsCount + (unitsCount === 1 ? " unit logged" : " units logged"));
    parts.push("streak " + streak);
    line.textContent = parts.join(" \u00b7 ");
  }
  box.appendChild(line);

  return box;
}
