/* ===== CHARACTER.JS =====
   Phase E: the stat sheet — identity, levels, the work-mode profile, lifetime totals
   (handoff §9 ⑤, design spec §9). Top to bottom: identity block (name + class line),
   level row (badge + xp text + title), class levels (Mathematician/Physicist, side by
   side), 6-axis stats radar (real trig per design spec §9.4), lifetime counters grid,
   attributes grid, titles-earned list.

   RECONCILIATION: the handoff's Identity header ("Lv 7 · Title, with a bar to next
   level") and the design spec's more detailed Level row (badge + xp number + title
   beside it) describe the same information. Per build-plan §2 ("design spec is
   authoritative on look"), this file follows the design spec's layout — the glyph's
   own ring arc *is* the bar to next level, so no separate horizontal bar is added on
   top of it (would be redundant).

   Small helpers (escapeHtml/clamp01-adjacent) are duplicated here rather than imported
   from other screen files, per build-plan §1's one-file-per-screen convention.
   isSkillRusting, buildSkillGlyph, masteryLevelFromXP, overallLevelFromXP,
   classLevelFromXP, titleForLevel, clamp01 are genuinely shared and already live in
   core.js. */

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

/* ---------- Screen: Character ---------- */

function renderCharacter() {
  var state = getState();
  var wrap = document.createElement("div");
  wrap.className = "character-wrap";

  wrap.appendChild(renderIdentityBlock(state));
  wrap.appendChild(renderLevelRow(state));
  wrap.appendChild(renderClassLevelsRow(state));
  wrap.appendChild(renderStatsRadarCard(state));
  wrap.appendChild(renderLifetimeCountersCard(state));
  wrap.appendChild(renderAttributesCard(state));
  wrap.appendChild(renderTitlesEarnedCard(state));

  return wrap;
}

/* ---------- ① Identity block ----------
   Centered player name (editable inline — pencil -> input -> blur/Enter commits, same
   interaction as the Skill Detail rename in skills.js) + a fixed class line. The class
   name text is the literal example from design spec §9.1 ("Diagrammatic Algebraist
   (provisional)") rather than something computed from skill standings — it names the
   user's actual research direction (the Bigelow campaign / capstone branch), which
   isn't something a level/XP heuristic would reliably land on anyway.
   playerName isn't part of the pinned data-model schema (handoff §11); it's a small,
   harmless in-app-editable addition the design spec's identity block calls for. */

function renderIdentityBlock(state) {
  var block = document.createElement("div");
  block.className = "identity-block";

  var nameRow = document.createElement("div");
  nameRow.className = "identity-name-row";

  var nameText = document.createElement("p");
  nameText.className = "identity-name";
  nameText.textContent = state.playerName || "Mathematician";
  nameRow.appendChild(nameText);

  var editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.setAttribute("aria-label", "Edit name");
  editBtn.textContent = "\u270e";
  editBtn.addEventListener("click", function () {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "identity-name-input";
    input.value = state.playerName || "";
    input.placeholder = "Mathematician";
    nameRow.replaceChild(input, nameText);
    editBtn.style.display = "none";
    input.focus();
    input.select();
    function commit() {
      var v = input.value.trim();
      state.playerName = v || null;
      saveState();
      refreshCurrentScreen();
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") input.blur(); });
  });
  nameRow.appendChild(editBtn);
  block.appendChild(nameRow);

  var classLine = document.createElement("p");
  classLine.className = "identity-class-line small-caps";
  classLine.innerHTML = "Class: <span class=\"class-name\">Diagrammatic Algebraist (provisional)</span>";
  block.appendChild(classLine);

  return block;
}

/* ---------- ② Level row ----------
   64px badge glyph (ring = progress to next Overall Level, disc always amber per
   design spec — masteryDepth here is a cosmetic scale against overall level, not a
   real mastery reading, since Overall Level has no analogous decaying quantity) +
   text block (Level + Title, large xp/xp-to-next number, small-caps caption). */

function renderLevelRow(state) {
  var card = document.createElement("div");
  card.className = "card level-row";

  var info = overallLevelFromXP(state.lifetimeXP);
  var title = titleForLevel(state, info.level);

  var glyphWrap = document.createElement("div");
  glyphWrap.innerHTML = buildSkillGlyph({
    size: 64,
    fraction: info.xpForNextLevel ? (info.xpIntoLevel / info.xpForNextLevel) : 0,
    numeral: info.level,
    masteryDepth: clamp01(info.level / 15),
    active: false, // forces the amber disc fill, per design spec ("disc always amber")
    showMastery: true
  });
  card.appendChild(glyphWrap);

  var text = document.createElement("div");
  text.className = "level-row-text";
  text.innerHTML =
    '<p class="level-row-title">Level ' + info.level + ' \u00b7 ' + escapeHtml(title) + '</p>' +
    '<p class="level-row-xp">' + info.xpIntoLevel + ' / ' + info.xpForNextLevel + '</p>' +
    '<p class="level-row-caption small-caps">xp to Level ' + (info.level + 1) + '</p>';
  card.appendChild(text);

  return card;
}

/* ---------- ③ Class levels ----------
   Two parallel counters, "both"-tagged skills feed both in full (never split) — see
   log.js fan-out step 3. Purely a read of classXP, no gating either. */

function renderClassLevelsRow(state) {
  var card = document.createElement("div");
  card.className = "card class-levels-row";

  var mathInfo = classLevelFromXP(state.classXP.math || 0);
  var physInfo = classLevelFromXP(state.classXP.physics || 0);

  var mathCard = document.createElement("div");
  mathCard.className = "class-level-card";
  mathCard.innerHTML =
    '<p class="class-level-value">Lv ' + mathInfo.level + '</p>' +
    '<p class="class-level-label small-caps">Mathematician</p>';
  card.appendChild(mathCard);

  var physCard = document.createElement("div");
  physCard.className = "class-level-card";
  physCard.innerHTML =
    '<p class="class-level-value">Lv ' + physInfo.level + '</p>' +
    '<p class="class-level-label small-caps">Physicist</p>';
  card.appendChild(physCard);

  return card;
}

/* ---------- ④ Stats radar ----------
   6 axes (Technique, Rigor, Abstraction, Intuition, Exposition, Literature), nested
   --rule grid rings at 33/66/100% radius, --rule-faint spokes, one filled --amber data
   polygon. Coordinates via real trig (design spec §9.4): angle = -pi/2 + i*(2pi/6),
   point = center + r*(cos,sin) — i=0 (Technique) sits at 12 o'clock, then clockwise.

   Normalization: each axis is scaled against the *current max stat value* (floor 1,
   to avoid divide-by-zero on a fresh tree), not a fixed absolute cap. Stats are
   cumulative and open-ended, so there's no natural ceiling to pin the chart to — this
   keeps the polygon's *shape* (relative balance across modes of work) legible at any
   point in the tree's growth, which is what a radar chart is for. Absolute totals are
   already covered by the Lifetime counters below it. */

var RADAR_STAT_ORDER = ["technique", "rigor", "abstraction", "intuition", "exposition", "literature"];
var RADAR_STAT_LABELS = {
  technique: "Technique", rigor: "Rigor", abstraction: "Abstraction",
  intuition: "Intuition", exposition: "Exposition", literature: "Literature"
};

function buildStatsRadarSVG(stats) {
  var n = RADAR_STAT_ORDER.length;
  var cx = 150, cy = 150, maxR = 96;

  var maxVal = 1;
  RADAR_STAT_ORDER.forEach(function (k) {
    if ((stats[k] || 0) > maxVal) maxVal = stats[k];
  });

  function pointAt(i, r) {
    var angle = -Math.PI / 2 + i * (2 * Math.PI / n);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  var svg = '<svg viewBox="0 0 300 300" class="radar-svg" aria-hidden="true">';

  // Grid rings
  [0.33, 0.66, 1.0].forEach(function (frac) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var p = pointAt(i, maxR * frac);
      pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1));
    }
    svg += '<polygon points="' + pts.join(" ") + '" fill="none" stroke="var(--rule)" stroke-width="1"/>';
  });

  // Spokes
  for (var i = 0; i < n; i++) {
    var sp = pointAt(i, maxR);
    svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + sp[0].toFixed(1) + '" y2="' + sp[1].toFixed(1) +
      '" stroke="var(--rule-faint)" stroke-width="1"/>';
  }

  // Data polygon
  var dataPts = [];
  for (var i = 0; i < n; i++) {
    var val = clamp01((stats[RADAR_STAT_ORDER[i]] || 0) / maxVal);
    var dp = pointAt(i, maxR * val);
    dataPts.push(dp[0].toFixed(1) + "," + dp[1].toFixed(1));
  }
  svg += '<polygon points="' + dataPts.join(" ") + '" fill="var(--amber)" fill-opacity="0.18" ' +
    'stroke="var(--amber)" stroke-width="1.6"/>';

  // Axis labels, just outside each tip
  for (var i = 0; i < n; i++) {
    var lp = pointAt(i, maxR + 22);
    var anchor = "middle";
    if (lp[0] < cx - 4) anchor = "end";
    else if (lp[0] > cx + 4) anchor = "start";
    svg += '<text x="' + lp[0].toFixed(1) + '" y="' + lp[1].toFixed(1) + '" text-anchor="' + anchor +
      '" dominant-baseline="middle" font-family="STIX Two Text, serif" font-size="9.5" ' +
      'font-variant="small-caps" letter-spacing="0.4" fill="var(--chalk-dim)">' +
      RADAR_STAT_LABELS[RADAR_STAT_ORDER[i]] + '</text>';
  }

  svg += '</svg>';
  return svg;
}

function renderStatsRadarCard(state) {
  var card = document.createElement("div");
  card.className = "card radar-card";
  var header = document.createElement("p");
  header.className = "card-header small-caps";
  header.textContent = "Stats";
  card.appendChild(header);

  var svgWrap = document.createElement("div");
  svgWrap.innerHTML = buildStatsRadarSVG(state.stats);
  card.appendChild(svgWrap);

  return card;
}

/* ---------- ⑤ Lifetime counters ----------
   Only-ever-climb numbers, per handoff §9⑤ / design spec §9.5: exercises, notes,
   experiments, exposition, papers read, total units. */

var LIFETIME_COUNTER_FIELDS = [
  { key: "exercises", label: "Exercises" },
  { key: "notes", label: "Notes" },
  { key: "experiments", label: "Experiments" },
  { key: "exposition", label: "Exposition" },
  { key: "papersRead", label: "Papers read" },
  { key: "totalUnits", label: "Total units" }
];

function renderLifetimeCountersCard(state) {
  var card = document.createElement("div");
  card.className = "card";
  var header = document.createElement("p");
  header.className = "card-header small-caps";
  header.textContent = "Lifetime counters";
  card.appendChild(header);

  var grid = document.createElement("div");
  grid.className = "counter-grid";
  LIFETIME_COUNTER_FIELDS.forEach(function (f) {
    var c = document.createElement("div");
    c.className = "counter-card";
    c.innerHTML =
      '<p class="counter-label small-caps">' + f.label + '</p>' +
      '<p class="counter-value">' + (state.counters[f.key] || 0) + '</p>';
    grid.appendChild(c);
  });
  card.appendChild(grid);

  return card;
}

/* ---------- ⑥ Attributes ----------
   Secondary grid, design spec §9.6: Total mastery, Skills rusting, Active synergies,
   Longest streak — color-matched (amber = accumulation, rust = the rusting count,
   celadon = synergies, default chalk = neutral).

   "Total mastery" = sum of every skill's current Mastery *level* (not raw XP, which
   would mix scales across skills) — a single number for "how much grinding depth is
   banked across the whole tree." "Active synergies" counts skills carrying a
   synergyNote, matching skills.js's own simplification (glow renders whenever
   synergyNote is present, since the seed only carries prose, not structured prereq
   refs — see skills.js Phase C notes). */

function computeTotalMasteryLevels(state) {
  var total = 0;
  state.skills.forEach(function (s) {
    total += masteryLevelFromXP(s.masteryXP).level;
  });
  return total;
}

function computeLongestStreak(state) {
  var dates = Object.keys(state.dailyActivity)
    .filter(function (d) { return state.dailyActivity[d] > 0; })
    .sort();
  if (!dates.length) return 0;
  var longest = 1, current = 1;
  for (var i = 1; i < dates.length; i++) {
    var prev = new Date(dates[i - 1] + "T00:00:00");
    var cur = new Date(dates[i] + "T00:00:00");
    var diffDays = Math.round((cur - prev) / (24 * 60 * 60 * 1000));
    current = (diffDays === 1) ? current + 1 : 1;
    if (current > longest) longest = current;
  }
  return longest;
}

function renderAttributesCard(state) {
  var card = document.createElement("div");
  card.className = "card";
  var header = document.createElement("p");
  header.className = "card-header small-caps";
  header.textContent = "Attributes";
  card.appendChild(header);

  var rustingCount = state.skills.filter(function (s) { return isSkillRusting(state, s); }).length;
  var synergyCount = state.skills.filter(function (s) { return !!s.synergyNote; }).length;

  var attrs = [
    { label: "Total mastery", value: computeTotalMasteryLevels(state), cls: "amber-val" },
    { label: "Skills rusting", value: rustingCount, cls: "rust-val" },
    { label: "Active synergies", value: synergyCount, cls: "celadon-val" },
    { label: "Longest streak", value: computeLongestStreak(state), cls: "" }
  ];

  var grid = document.createElement("div");
  grid.className = "attr-grid";
  attrs.forEach(function (a) {
    var c = document.createElement("div");
    c.className = "attr-card";
    c.innerHTML =
      '<p class="attr-label small-caps">' + a.label + '</p>' +
      '<p class="attr-value ' + a.cls + '">' + a.value + '</p>';
    grid.appendChild(c);
  });
  card.appendChild(grid);

  return card;
}

/* ---------- ⑦ Titles earned ----------
   Simple row list (not cards) per design spec §9.7. Threshold matches core.js's
   titleForLevel (one rank every 3 Overall Levels): title i is earned once Overall
   Level >= i*3. */

var TITLE_BADGE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 L14.2 9.2 L20.8 9.5 L15.6 13.6 L17.4 20 ' +
  'L12 16.2 L6.6 20 L8.4 13.6 L3.2 9.5 L9.8 9.2 Z" fill="none" stroke="var(--amber)" stroke-width="1.4" ' +
  'stroke-linejoin="round"/></svg>';

function renderTitlesEarnedCard(state) {
  var card = document.createElement("div");
  card.className = "card";
  var header = document.createElement("p");
  header.className = "card-header small-caps";
  header.textContent = "Titles earned";
  card.appendChild(header);

  var ladder = state.titlesLadder || SEED_TITLES_LADDER;
  var overallLevel = overallLevelFromXP(state.lifetimeXP).level;

  var list = document.createElement("div");
  ladder.forEach(function (name, idx) {
    var threshold = idx * 3;
    if (overallLevel < threshold) return; // not yet earned — omit rather than gray out, no gating text needed

    var row = document.createElement("div");
    row.className = "title-row";
    row.innerHTML =
      '<span class="title-badge">' + TITLE_BADGE_SVG + '</span>' +
      '<div class="title-text">' +
      '<p class="title-name">' + escapeHtml(name) + '</p>' +
      '<p class="title-sub small-caps">' +
      (threshold === 0 ? "starting rank" : "reached at Overall Level " + threshold) +
      '</p></div>';
    list.appendChild(row);
  });
  card.appendChild(list);

  return card;
}
