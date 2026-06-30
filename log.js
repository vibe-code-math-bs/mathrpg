/* ===== LOG.JS =====
   Phase B: the Log modal (unit type -> skill -> source -> note -> save) wired to the
   write fan-out (mathrpg-build-plan.md §4), plus the reward beat (XP count-up + level-up
   pulse). openLogModal() is what core.js's log button looks for. */

const UNIT_TYPE_INFO = [
  { key: "notes", name: "Notes", desc: "input · reading" },
  { key: "exercise", name: "Exercise", desc: "output · w/ key" },
  { key: "experiment", name: "Experiment", desc: "output · open" },
  { key: "exposition", name: "Exposition", desc: "writing · talks" }
];

// Remembered across modal opens (same page load only — not persisted) so a second
// log of the same skill/source is a tap-tap-save, per the spec's "≤3 taps" goal.
let _lastUnitType = null;
let _lastSkillId = null;
let _lastSourceId = null;

/* ---------- Modal lifecycle ---------- */

function openLogModal() {
  if (document.getElementById("log-modal-overlay")) return;

  const state = getState();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "log-modal-overlay";

  const card = document.createElement("div");
  card.className = "modal-card";
  overlay.appendChild(card);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeLogModal();
  });
  document.addEventListener("keydown", _escListener);

  document.body.appendChild(overlay);
  renderLogForm(card, state);
}

function _escListener(e) {
  if (e.key === "Escape") closeLogModal();
}

function closeLogModal() {
  const overlay = document.getElementById("log-modal-overlay");
  if (overlay) overlay.remove();
  document.removeEventListener("keydown", _escListener);
}

/* ---------- Step 1: the form ---------- */

function renderLogForm(card, state) {
  card.innerHTML = "";

  card.appendChild(buildModalCloseButton());

  const eyebrow = document.createElement("p");
  eyebrow.className = "modal-eyebrow small-caps";
  eyebrow.textContent = "Log a unit";
  card.appendChild(eyebrow);

  const title = document.createElement("p");
  title.className = "modal-title";
  title.textContent = "What did you do?";
  card.appendChild(title);

  // Local form state, prefilled from the last log this session.
  const form = { unitType: _lastUnitType, skillId: _lastSkillId, sourceId: _lastSourceId, note: "" };

  /* --- Unit type --- */
  const utGrid = document.createElement("div");
  utGrid.className = "unit-type-grid";
  UNIT_TYPE_INFO.forEach(function (ut) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "unit-type-btn" + (form.unitType === ut.key ? " active" : "");
    btn.innerHTML =
      '<span class="ut-name">' + ut.name + '</span>' +
      '<span class="ut-desc small-caps">' + ut.desc + '</span>';
    btn.addEventListener("click", function () {
      form.unitType = ut.key;
      utGrid.querySelectorAll(".unit-type-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      updateSaveEnabled();
    });
    utGrid.appendChild(btn);
  });
  card.appendChild(utGrid);

  /* --- Skill --- */
  const skillField = document.createElement("div");
  skillField.className = "log-field";
  skillField.innerHTML = '<label class="field-label">Skill</label>';

  const skillSelect = document.createElement("select");
  const skillPlaceholder = document.createElement("option");
  skillPlaceholder.value = "";
  skillPlaceholder.textContent = "Choose a skill…";
  skillSelect.appendChild(skillPlaceholder);

  const byBranch = {};
  const branchOrder = [];
  state.skills.forEach(function (s) {
    if (!byBranch[s.branch]) { byBranch[s.branch] = []; branchOrder.push(s.branch); }
    byBranch[s.branch].push(s);
  });
  branchOrder.forEach(function (branch) {
    const og = document.createElement("optgroup");
    og.label = BRANCH_LABELS[branch] || branch;
    byBranch[branch].forEach(function (s) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      if (form.skillId === s.id) opt.selected = true;
      og.appendChild(opt);
    });
    skillSelect.appendChild(og);
  });
  skillField.appendChild(skillSelect);

  const skillPreview = document.createElement("div");
  skillField.appendChild(skillPreview);
  card.appendChild(skillField);

  function renderSkillPreview() {
    skillPreview.innerHTML = "";
    if (!form.skillId) return;
    const skill = skillById(state, form.skillId);
    if (!skill) return;
    const row = document.createElement("div");
    row.className = "skill-preview-row";
    row.innerHTML =
      skillGlyphForSkill(state, skill, { size: 38 }) +
      '<span class="skill-preview-text small-caps">Lv ' + skill.level +
      ' · Mastery ' + masteryLevelFromXP(skill.masteryXP).level + '</span>';
    skillPreview.appendChild(row);
  }
  renderSkillPreview();

  skillSelect.addEventListener("change", function () {
    form.skillId = skillSelect.value || null;
    renderSkillPreview();
    updateSaveEnabled();
  });

  /* --- Source --- */
  const sourceField = document.createElement("div");
  sourceField.className = "log-field";
  sourceField.innerHTML = '<label class="field-label">Source</label>';

  const sourceSelect = document.createElement("select");
  const sourcePlaceholder = document.createElement("option");
  sourcePlaceholder.value = "";
  sourcePlaceholder.textContent = "Choose a source…";
  sourceSelect.appendChild(sourcePlaceholder);
  state.sources.forEach(function (src) {
    const opt = document.createElement("option");
    opt.value = src.id;
    opt.textContent = src.name + " — " + TIER_LABELS[src.tier];
    if (form.sourceId === src.id) opt.selected = true;
    sourceSelect.appendChild(opt);
  });
  sourceField.appendChild(sourceSelect);

  const weightLine = document.createElement("p");
  weightLine.className = "source-weight-line";
  sourceField.appendChild(weightLine);
  card.appendChild(sourceField);

  function renderWeightLine() {
    const src = state.sources.find(function (s) { return s.id === form.sourceId; });
    weightLine.textContent = src ? ("Tier weight ×" + TIER_WEIGHTS[src.tier].toFixed(1)) : "";
  }
  renderWeightLine();

  sourceSelect.addEventListener("change", function () {
    form.sourceId = sourceSelect.value || null;
    renderWeightLine();
    updateSaveEnabled();
  });

  /* --- Note --- */
  const noteField = document.createElement("div");
  noteField.className = "log-field";
  noteField.innerHTML = '<label class="field-label">Note (optional)</label>';
  const noteInput = document.createElement("textarea");
  noteInput.placeholder = "What did you work on?";
  noteInput.addEventListener("input", function () { form.note = noteInput.value; });
  noteField.appendChild(noteInput);
  card.appendChild(noteField);

  /* --- Save --- */
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.style.width = "100%";
  saveBtn.textContent = "Save";
  card.appendChild(saveBtn);

  function updateSaveEnabled() {
    saveBtn.disabled = !(form.unitType && form.skillId && form.sourceId);
  }
  updateSaveEnabled();

  saveBtn.addEventListener("click", function () {
    if (!(form.unitType && form.skillId && form.sourceId)) return;
    const result = submitLogEntry(form.unitType, form.skillId, form.sourceId, form.note);
    if (!result) return;
    _lastUnitType = form.unitType;
    _lastSkillId = form.skillId;
    _lastSourceId = form.sourceId;
    renderRewardBeat(card, getState(), result);
  });
}

function buildModalCloseButton() {
  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", closeLogModal);
  return closeBtn;
}

/* ---------- The §4 write fan-out (the engine) ---------- */

function submitLogEntry(unitType, skillId, sourceId, note) {
  const state = getState();
  const skill = skillById(state, skillId);
  const source = state.sources.find(function (s) { return s.id === sourceId; });
  if (!skill || !source) return null;

  const weight = TIER_WEIGHTS[source.tier];
  const xp = UNIT_BASE_XP[unitType] * weight;

  // Snapshot "before" levels so we can detect level-ups after writing.
  const beforeOverall = overallLevelFromXP(state.lifetimeXP).level;
  const beforeMastery = masteryLevelFromXP(skill.masteryXP).level;
  const beforeClassMath = classLevelFromXP(state.classXP.math).level;
  const beforeClassPhysics = classLevelFromXP(state.classXP.physics).level;

  // 1-2. lifetime XP
  state.lifetimeXP += xp;

  // 3. class XP — both ledgers if classTag is "both"
  if (skill.classTag === "both") {
    state.classXP.math += xp;
    state.classXP.physics += xp;
  } else {
    state.classXP[skill.classTag] += xp;
  }

  // 4. skill mastery XP
  skill.masteryXP += xp;

  // 5. stat grants (fixed unit->stat mapping, +10 flat each)
  const statKeys = UNIT_STAT_MAP[unitType];
  const statsGranted = {};
  statKeys.forEach(function (k) {
    state.stats[k] += STAT_GRANT_PER_UNIT;
    statsGranted[k] = STAT_GRANT_PER_UNIT;
  });

  // 6. lifetime counters + totalUnits
  // BUILD CHOICE: "Notes" = a chapter/paper read & absorbed (handoff §1), so a Notes
  // unit also bumps papersRead — the seed data model has no separate "is this a paper"
  // flag to key off instead.
  const counterKeyMap = { notes: "notes", exercise: "exercises", experiment: "experiments", exposition: "exposition" };
  state.counters[counterKeyMap[unitType]] += 1;
  if (unitType === "notes") state.counters.papersRead += 1;
  state.counters.totalUnits += 1;

  // 7. heatmap (weighted by tier, per build-plan §4)
  const today = todayISO();
  state.dailyActivity[today] = (state.dailyActivity[today] || 0) + weight;

  // 8. lastTouched
  const now = Date.now();
  skill.lastTouched = now;

  // 9. due focus on this skill -> met + streak
  let focusMet = null;
  state.foci.forEach(function (focus) {
    if (!focus.active || focus.skillId !== skillId) return;
    focusMet = updateFocusOnLog(focus, now);
  });

  // 10. push log entry
  state.log.push({
    ts: now, unitType: unitType, skillId: skillId, sourceId: sourceId,
    note: note || "", xpGranted: xp, statsGranted: statsGranted
  });

  // 11. save + recompute levels for the reward beat
  saveState();
  const afterOverall = overallLevelFromXP(state.lifetimeXP);
  const afterMastery = masteryLevelFromXP(skill.masteryXP);
  const afterClassMath = classLevelFromXP(state.classXP.math);
  const afterClassPhysics = classLevelFromXP(state.classXP.physics);

  // 13. re-render whatever screen is behind the modal (no-op against placeholders)
  refreshCurrentScreen();

  return {
    skill: skill,
    xp: xp,
    statsGranted: statsGranted,
    overallLevelUp: afterOverall.level > beforeOverall,
    overallLevel: afterOverall.level,
    masteryLevelUp: afterMastery.level > beforeMastery,
    masteryLevel: afterMastery.level,
    classLevelUps: {
      math: afterClassMath.level > beforeClassMath ? afterClassMath.level : null,
      physics: afterClassPhysics.level > beforeClassPhysics ? afterClassPhysics.level : null
    },
    focusMet: focusMet
  };
}

// Cadence handling for foci (handoff §5): "met this period" rolls forward without
// breaking on a single missed day; a fully missed period restarts the streak.
function updateFocusOnLog(focus, now) {
  const dayMs = 24 * 60 * 60 * 1000;
  const cadenceDaysMap = { daily: 1, "semi-weekly": 3.5, weekly: 7, custom: 7 };
  const cadenceMs = (cadenceDaysMap[focus.cadence] || 7) * dayMs;

  if (!focus.lastMet) {
    focus.streak = 1;
  } else {
    const gap = now - focus.lastMet;
    if (gap < cadenceMs) {
      // already met this period — timestamp refreshes, streak unchanged
    } else if (gap < cadenceMs * 2) {
      focus.streak = (focus.streak || 0) + 1;
    } else {
      focus.streak = 1; // missed a full period
    }
  }
  focus.lastMet = now;
  return { name: focus.name, streak: focus.streak };
}

/* ---------- Step 2: the reward beat ----------
   ~half-second XP count-up + a celebratory pulse on any level-up. Small and tasteful,
   not confetti, per handoff §9 ③. */

function renderRewardBeat(card, state, result) {
  card.innerHTML = "";
  card.appendChild(buildModalCloseButton());

  const beat = document.createElement("div");
  beat.className = "reward-beat";

  const eyebrow = document.createElement("p");
  eyebrow.className = "modal-eyebrow small-caps";
  eyebrow.textContent = "Logged";
  beat.appendChild(eyebrow);

  const glyphWrap = document.createElement("div");
  glyphWrap.className = "reward-glyph-wrap";
  glyphWrap.innerHTML = skillGlyphForSkill(state, result.skill, { size: 64, active: true });
  beat.appendChild(glyphWrap);

  const skillName = document.createElement("p");
  skillName.className = "reward-skill-name";
  skillName.textContent = result.skill.name;
  beat.appendChild(skillName);

  const xpEl = document.createElement("p");
  xpEl.className = "reward-xp";
  xpEl.textContent = "+0 XP";
  beat.appendChild(xpEl);

  const statsRow = document.createElement("div");
  statsRow.className = "reward-stats";
  Object.keys(result.statsGranted).forEach(function (k) {
    const pill = document.createElement("span");
    pill.className = "reward-stat-pill";
    pill.textContent = "+" + result.statsGranted[k] + " " + capitalize(k);
    statsRow.appendChild(pill);
  });
  beat.appendChild(statsRow);

  const levelUpLines = [];
  if (result.masteryLevelUp) levelUpLines.push(result.skill.name + " — now Mastery " + result.masteryLevel);
  if (result.overallLevelUp) levelUpLines.push("Character — now Level " + result.overallLevel);
  if (result.classLevelUps.math) levelUpLines.push("Mathematician — now Lv " + result.classLevelUps.math);
  if (result.classLevelUps.physics) levelUpLines.push("Physicist — now Lv " + result.classLevelUps.physics);

  if (levelUpLines.length) {
    const box = document.createElement("div");
    box.className = "reward-levelup pulse";
    levelUpLines.forEach(function (msg) {
      const p = document.createElement("p");
      p.textContent = "Level up — " + msg;
      box.appendChild(p);
    });
    beat.appendChild(box);
    glyphWrap.classList.add("pulse");
  }

  if (result.focusMet) {
    const focusLine = document.createElement("p");
    focusLine.className = "reward-focus-line small-caps";
    focusLine.textContent = "Focus met — " + result.focusMet.name + " · streak " + result.focusMet.streak;
    beat.appendChild(focusLine);
  }

  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";
  const againBtn = document.createElement("button");
  againBtn.className = "btn";
  againBtn.textContent = "Log another";
  againBtn.addEventListener("click", function () { renderLogForm(card, getState()); });
  const doneBtn = document.createElement("button");
  doneBtn.className = "btn btn-primary";
  doneBtn.textContent = "Done";
  doneBtn.addEventListener("click", closeLogModal);
  btnRow.appendChild(againBtn);
  btnRow.appendChild(doneBtn);
  beat.appendChild(btnRow);

  card.appendChild(beat);

  animateXPCountUp(xpEl, result.xp);
}

function animateXPCountUp(el, target) {
  const duration = 500;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 2);
    el.textContent = "+" + Math.round(target * eased) + " XP";
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = "+" + target + " XP";
  }
  requestAnimationFrame(step);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
