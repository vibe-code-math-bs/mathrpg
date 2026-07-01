/* ===== SKILLS.JS =====
   Phase C: the skill tree. Branch sections -> specimen card grid (design spec §6),
   synergy full-width cards, branch completion meters, glyph legend box. Tapping a
   card opens the Skill Detail modal: roadmap checklist (check/uncheck raises/lowers
   Level), inline rename of subtopics, add/remove subtopics, a rename control on the
   skill itself, a hand-rolled Mastery bar (not a native <progress> — see design spec
   §11), and that skill's unit history. A dashed "+ Add a new skill" affordance opens
   a second modal for registering brand-new skill nodes (name, branch — existing or
   new — class, maintenance flag, optional starting roadmap using the seed file's own
   "[x] / [ ]" line convention). No tree gating anywhere: every card is always tappable.

   Deferred (not in this phase): the design spec's Skills-only top-bar filter-pill
   row (§4). Branch sections + card content already give a full browse/filter-free
   view of the tree; the filter row is a nice-to-have that can slot in later without
   touching this file's data flow. */

/* ---------- Branch helpers ---------- */

function getBranchOrder(state) {
  var order = SEED_BRANCHES.map(function (b) { return { id: b.id, name: b.name, tag: b.tag || null }; });
  var known = {};
  order.forEach(function (b) { known[b.id] = true; });
  state.skills.forEach(function (s) {
    if (!known[s.branch]) {
      known[s.branch] = true;
      order.push({ id: s.branch, name: branchLabelFallback(s.branch), tag: null });
    }
  });
  return order;
}

function branchLabelFallback(id) {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function branchLabel(branchId) {
  var found = SEED_BRANCHES.find(function (b) { return b.id === branchId; });
  if (found) return found.name;
  if (BRANCH_LABELS[branchId]) return BRANCH_LABELS[branchId];
  return branchLabelFallback(branchId);
}

// "Currently active/being worked" -> celadon disc + active pill (design spec §5.2).
// Heuristic: touched in the last 14 days, or is the target of a currently-active focus.
function isSkillActive(state, skill) {
  if (skill.lastTouched) {
    var d = daysAgo(skill.lastTouched);
    if (d !== null && d <= 14) return true;
  }
  return state.foci.some(function (f) { return f.active && f.skillId === skill.id; });
}

function recomputeSkillLevel(skill) {
  skill.level = (skill.roadmap || []).filter(function (r) { return r.done; }).length;
}

/* ---------- Small local helpers (kept self-contained per-file, per build-plan §1) ---------- */

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slugify(str) {
  return (str || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "skill";
}

function uniqueSkillId(state, base) {
  var id = base, n = 2;
  while (state.skills.some(function (s) { return s.id === id; })) {
    id = base + "-" + n;
    n++;
  }
  return id;
}

function buildCloseButton(onClose) {
  var btn = document.createElement("button");
  btn.className = "modal-close";
  btn.setAttribute("aria-label", "Close");
  btn.innerHTML = "&times;";
  btn.addEventListener("click", onClose);
  return btn;
}

function makePill(text, cls) {
  var span = document.createElement("span");
  span.className = "pill " + cls + " small-caps";
  span.textContent = text;
  return span;
}

/* ---------- Screen: Skills ---------- */

function renderSkills() {
  var state = getState();
  var wrap = document.createElement("div");
  wrap.className = "skills-wrap";

  getBranchOrder(state).forEach(function (branch) {
    var skillsInBranch = state.skills.filter(function (s) { return s.branch === branch.id; });
    if (!skillsInBranch.length) return;
    wrap.appendChild(renderBranchSection(state, branch, skillsInBranch));
  });

  wrap.appendChild(renderAddSkillButton());
  wrap.appendChild(renderLegendBox());

  return wrap;
}

function renderBranchSection(state, branch, skills) {
  var section = document.createElement("section");
  section.className = "branch-section";

  var totalSub = 0, doneSub = 0;
  skills.forEach(function (s) {
    totalSub += (s.roadmap ? s.roadmap.length : 0);
    doneSub += s.level;
  });

  var header = document.createElement("div");
  header.className = "branch-header-row";

  var left = document.createElement("div");
  left.className = "branch-header-left";
  var nameEl = document.createElement("p");
  nameEl.className = "branch-name";
  nameEl.textContent = branch.name;
  left.appendChild(nameEl);
  if (branch.tag) {
    var tagEl = document.createElement("span");
    tagEl.className = "branch-tag small-caps" + (branch.tag === "rusts" ? " rust" : "");
    tagEl.textContent = branch.tag;
    left.appendChild(tagEl);
  }
  header.appendChild(left);

  var meter = document.createElement("span");
  meter.className = "branch-meter small-caps";
  meter.textContent = "subtopics " + doneSub + " / " + totalSub;
  header.appendChild(meter);

  section.appendChild(header);

  var grid = document.createElement("div");
  grid.className = "skill-grid";
  skills.forEach(function (skill) {
    grid.appendChild(renderSkillCard(state, skill));
    if (skill.synergyNote) grid.appendChild(renderSynergyCard(state, skill));
  });
  section.appendChild(grid);

  return section;
}

function renderSkillCard(state, skill) {
  var active = isSkillActive(state, skill);
  var rusting = isSkillRusting(state, skill);
  var masteryLevel = masteryLevelFromXP(skill.masteryXP).level;

  var card = document.createElement("button");
  card.type = "button";
  card.className = "skill-card";
  card.addEventListener("click", function () { openSkillDetail(skill.id); });

  var glyphWrap = document.createElement("div");
  glyphWrap.innerHTML = skillGlyphForSkill(state, skill, { size: 64, active: active });
  card.appendChild(glyphWrap);

  if (skill.synergyNote) {
    var mark = document.createElement("span");
    mark.className = "synergy-mark";
    mark.title = "Synergy node";
    mark.textContent = "\u2726";
    card.appendChild(mark);
  }

  var nameEl = document.createElement("p");
  nameEl.className = "skill-card-name";
  nameEl.textContent = skill.name;
  card.appendChild(nameEl);

  var statusEl = document.createElement("p");
  statusEl.className = "skill-card-status small-caps" + (rusting ? " rust-status" : (active ? " active-status" : ""));
  statusEl.textContent = "Lv " + skill.level + " \u00b7 Mastery " + masteryLevel;
  card.appendChild(statusEl);

  var pills = document.createElement("div");
  pills.className = "skill-card-pills";
  if (rusting) pills.appendChild(makePill("rusty", "pill-rust"));
  else if (active) pills.appendChild(makePill("active", "pill-celadon"));
  if (skill.priorityGrowth) pills.appendChild(makePill("priority growth", "pill-dim"));
  if (skill.activeResearch) pills.appendChild(makePill("active research", "pill-dim"));
  if (pills.children.length) card.appendChild(pills);

  return card;
}

function renderSynergyCard(state, skill) {
  var card = document.createElement("div");
  card.className = "synergy-card";
  card.innerHTML =
    skillGlyphForSkill(state, skill, { size: 48, active: isSkillActive(state, skill), showMastery: false }) +
    '<div><p class="synergy-label small-caps">Synergy</p>' +
    '<p class="synergy-text">' + escapeHtml(skill.synergyNote) + '</p></div>';
  return card;
}

function renderAddSkillButton() {
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "add-skill-card small-caps";
  btn.textContent = "+ Add a new skill";
  btn.addEventListener("click", openAddSkillModal);
  return btn;
}

function renderLegendBox() {
  var box = document.createElement("div");
  box.className = "legend-box";

  var title = document.createElement("p");
  title.className = "legend-title small-caps";
  title.textContent = "Glyph legend";
  box.appendChild(title);

  var items = document.createElement("div");
  items.className = "legend-items";

  var levelGlyph = buildSkillGlyph({ size: 44, fraction: 0.7, numeral: "", showMastery: false });
  var masteryGlyph = buildSkillGlyph({ size: 44, fraction: 0, numeral: "", masteryDepth: 0.75 });
  var rustGlyph = buildSkillGlyph({ size: 44, fraction: 0.4, numeral: "", masteryDepth: 0.3, rusting: true });

  items.appendChild(legendItem(levelGlyph, "Level \u2014 ring, permanent"));
  items.appendChild(legendItem(masteryGlyph, "Mastery \u2014 disc, grinds up"));
  items.appendChild(legendItem(rustGlyph, "Rust \u2014 hatch, decaying"));

  box.appendChild(items);
  return box;
}

function legendItem(glyphHtml, label) {
  var el = document.createElement("div");
  el.className = "legend-item";
  el.innerHTML = glyphHtml + "<span>" + label + "</span>";
  return el;
}

/* ---------- Add Skill modal ---------- */

function openAddSkillModal() {
  if (document.getElementById("add-skill-overlay")) return;
  var state = getState();
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "add-skill-overlay";
  var card = document.createElement("div");
  card.className = "modal-card";
  overlay.appendChild(card);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeAddSkillModal(); });
  document.addEventListener("keydown", _addSkillEscListener);
  document.body.appendChild(overlay);
  renderAddSkillForm(card, state);
}

function _addSkillEscListener(e) { if (e.key === "Escape") closeAddSkillModal(); }

function closeAddSkillModal() {
  var overlay = document.getElementById("add-skill-overlay");
  if (overlay) overlay.remove();
  document.removeEventListener("keydown", _addSkillEscListener);
}

function renderAddSkillForm(card, state) {
  card.innerHTML = "";
  card.appendChild(buildCloseButton(closeAddSkillModal));

  var eyebrow = document.createElement("p");
  eyebrow.className = "modal-eyebrow small-caps";
  eyebrow.textContent = "New skill";
  card.appendChild(eyebrow);

  var title = document.createElement("p");
  title.className = "modal-title";
  title.textContent = "Add a skill to the tree";
  card.appendChild(title);

  var branches = getBranchOrder(state);
  var form = {
    name: "", branch: branches.length ? branches[0].id : "__new__",
    newBranchName: "", classTag: "math", maintenance: false, roadmapText: ""
  };

  /* Name */
  var nameField = document.createElement("div");
  nameField.className = "log-field";
  nameField.innerHTML = '<label class="field-label">Skill name</label>';
  var nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "e.g. Sheaf Theory";
  nameInput.addEventListener("input", function () { form.name = nameInput.value; updateSaveEnabled(); });
  nameField.appendChild(nameInput);
  card.appendChild(nameField);

  /* Branch */
  var branchField = document.createElement("div");
  branchField.className = "log-field";
  branchField.innerHTML = '<label class="field-label">Branch</label>';
  var branchSelect = document.createElement("select");
  branches.forEach(function (b) {
    var opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    branchSelect.appendChild(opt);
  });
  var newOpt = document.createElement("option");
  newOpt.value = "__new__";
  newOpt.textContent = "+ New branch\u2026";
  branchSelect.appendChild(newOpt);
  branchField.appendChild(branchSelect);

  var newBranchInput = document.createElement("input");
  newBranchInput.type = "text";
  newBranchInput.placeholder = "New branch name";
  newBranchInput.style.marginTop = "8px";
  newBranchInput.style.display = "none";
  newBranchInput.addEventListener("input", function () { form.newBranchName = newBranchInput.value; updateSaveEnabled(); });
  branchField.appendChild(newBranchInput);
  card.appendChild(branchField);

  branchSelect.addEventListener("change", function () {
    form.branch = branchSelect.value;
    newBranchInput.style.display = (form.branch === "__new__") ? "" : "none";
    updateSaveEnabled();
  });

  /* Class */
  var classField = document.createElement("div");
  classField.className = "log-field";
  classField.innerHTML = '<label class="field-label">Class</label>';
  var classSelect = document.createElement("select");
  [["math", "Mathematician"], ["physics", "Physicist"], ["both", "Both"]].forEach(function (pair) {
    var opt = document.createElement("option");
    opt.value = pair[0];
    opt.textContent = pair[1];
    classSelect.appendChild(opt);
  });
  classSelect.addEventListener("change", function () { form.classTag = classSelect.value; });
  classField.appendChild(classSelect);
  card.appendChild(classField);

  /* Maintenance */
  var maintField = document.createElement("div");
  maintField.className = "log-field";
  var maintRow = document.createElement("label");
  maintRow.className = "checkbox-row";
  var maintCheckbox = document.createElement("input");
  maintCheckbox.type = "checkbox";
  maintCheckbox.addEventListener("change", function () { form.maintenance = maintCheckbox.checked; });
  var maintText = document.createElement("span");
  maintText.className = "small-caps";
  maintText.textContent = "Rusts when idle (maintenance skill)";
  maintRow.appendChild(maintCheckbox);
  maintRow.appendChild(maintText);
  maintField.appendChild(maintRow);
  card.appendChild(maintField);

  /* Starting roadmap */
  var roadmapField = document.createElement("div");
  roadmapField.className = "log-field";
  roadmapField.innerHTML = '<label class="field-label">Starting roadmap (optional)</label>';
  var roadmapTextarea = document.createElement("textarea");
  roadmapTextarea.placeholder = "One subtopic per line. Prefix with [x] if already known:\n[x] basic definitions\n[ ] main theorem";
  roadmapTextarea.style.minHeight = "90px";
  roadmapTextarea.addEventListener("input", function () { form.roadmapText = roadmapTextarea.value; });
  roadmapField.appendChild(roadmapTextarea);
  var hint = document.createElement("p");
  hint.className = "field-hint";
  hint.textContent = "Add, rename, or remove subtopics later from the skill's detail view.";
  roadmapField.appendChild(hint);
  card.appendChild(roadmapField);

  /* Save */
  var saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.style.width = "100%";
  saveBtn.textContent = "Create skill";
  card.appendChild(saveBtn);

  function updateSaveEnabled() {
    var branchOk = form.branch !== "__new__" || form.newBranchName.trim().length > 0;
    saveBtn.disabled = !(form.name.trim().length > 0 && branchOk);
  }
  updateSaveEnabled();

  saveBtn.addEventListener("click", function () {
    var branchId = form.branch === "__new__" ? slugify(form.newBranchName) : form.branch;
    var roadmap = parseRoadmapText(form.roadmapText);
    var level = roadmap.filter(function (r) { return r.done; }).length;

    var newSkill = {
      id: uniqueSkillId(state, slugify(form.name)),
      name: form.name.trim(),
      branch: branchId,
      classTag: form.classTag,
      maintenance: form.maintenance,
      roadmap: roadmap,
      level: level,
      masteryXP: 0,
      lastTouched: null
    };
    state.skills.push(newSkill);
    saveState();
    closeAddSkillModal();
    refreshCurrentScreen();
  });
}

// Parses the seed file's own "[x] title" / "[ ] title" convention, one per line, so
// registering a new skill's starting roadmap feels exactly like editing the seed.
function parseRoadmapText(text) {
  if (!text) return [];
  return text.split("\n")
    .map(function (line) { return line.trim(); })
    .filter(function (line) { return line.length > 0; })
    .map(function (line) {
      // Strip a leading markdown bullet ("- ") before checking for the checkbox
      // marker, so lines pasted straight from the seed file's own "- [x] title"
      // format parse correctly, not just bare "[x] title" lines.
      line = line.replace(/^-+\s*/, "");
      var done = false;
      var m = line.match(/^\[( |x|X)\]\s*/);
      if (m) {
        done = (m[1].toLowerCase() === "x");
        line = line.slice(m[0].length);
      }
      return { title: line.trim(), done: done };
    })
    .filter(function (r) { return r.title.length > 0; });
}

/* ---------- Skill Detail modal ---------- */

function openSkillDetail(skillId) {
  if (document.getElementById("skill-detail-overlay")) return;
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "skill-detail-overlay";
  var card = document.createElement("div");
  card.className = "modal-card";
  overlay.appendChild(card);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeSkillDetail(); });
  document.addEventListener("keydown", _skillDetailEscListener);
  document.body.appendChild(overlay);
  renderSkillDetail(card, skillId);
}

function _skillDetailEscListener(e) { if (e.key === "Escape") closeSkillDetail(); }

function closeSkillDetail() {
  var overlay = document.getElementById("skill-detail-overlay");
  if (overlay) overlay.remove();
  document.removeEventListener("keydown", _skillDetailEscListener);
  refreshCurrentScreen();
}

function renderSkillDetail(card, skillId) {
  var state = getState();
  var skill = skillById(state, skillId);
  card.innerHTML = "";
  if (!skill) { closeSkillDetail(); return; }

  card.appendChild(buildCloseButton(closeSkillDetail));

  var eyebrow = document.createElement("p");
  eyebrow.className = "modal-eyebrow small-caps";
  eyebrow.textContent = branchLabel(skill.branch) + (skill.maintenance ? " \u00b7 maintenance" : "");
  card.appendChild(eyebrow);

  /* Title row w/ rename */
  var titleRow = document.createElement("div");
  titleRow.className = "skill-detail-title-row";
  var titleText = document.createElement("p");
  titleText.className = "modal-title";
  titleText.style.margin = "0";
  titleText.style.flex = "1";
  titleText.textContent = skill.name;
  titleRow.appendChild(titleText);

  var renameBtn = document.createElement("button");
  renameBtn.className = "icon-btn";
  renameBtn.setAttribute("aria-label", "Rename skill");
  renameBtn.textContent = "\u270e";
  renameBtn.addEventListener("click", function () {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "skill-detail-name-input";
    input.value = skill.name;
    titleRow.replaceChild(input, titleText);
    renameBtn.style.display = "none";
    input.focus();
    input.select();
    function commit() {
      var v = input.value.trim();
      if (v) { skill.name = v; saveState(); }
      renderSkillDetail(card, skillId);
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") input.blur(); });
  });
  titleRow.appendChild(renameBtn);
  card.appendChild(titleRow);

  /* Glyph + Level / Mastery summary */
  var summary = document.createElement("div");
  summary.className = "skill-detail-header";
  var maxLevel = (skill.roadmap && skill.roadmap.length) || 1;
  var masteryInfo = masteryLevelFromXP(skill.masteryXP);
  var pct = clamp01(masteryInfo.xpIntoLevel / masteryInfo.xpForNextLevel);

  var glyphWrap = document.createElement("div");
  glyphWrap.innerHTML = skillGlyphForSkill(state, skill, { size: 72, active: isSkillActive(state, skill) });
  summary.appendChild(glyphWrap);

  var summaryText = document.createElement("div");
  summaryText.style.flex = "1";
  summaryText.innerHTML =
    '<p class="small-caps" style="margin:0 0 4px; color:var(--chalk-dim)">Lv ' + skill.level + ' / ' + maxLevel + ' subtopics</p>' +
    '<p class="small-caps" style="margin:0 0 6px">Mastery ' + masteryInfo.level + '</p>' +
    '<div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:' + (pct * 100).toFixed(0) + '%"></div></div>' +
    '<p class="field-hint" style="margin:4px 0 0">' + masteryInfo.xpIntoLevel + ' / ' + masteryInfo.xpForNextLevel + ' xp to Mastery ' + (masteryInfo.level + 1) + '</p>';
  summary.appendChild(summaryText);
  card.appendChild(summary);

  if (isSkillRusting(state, skill)) {
    var rustNote = document.createElement("p");
    rustNote.className = "small-caps";
    rustNote.style.color = "var(--rust)";
    rustNote.style.margin = "8px 0 0";
    rustNote.textContent = "Rusting \u2014 last touched " + daysAgo(skill.lastTouched) + " days ago";
    card.appendChild(rustNote);
  }

  if (skill.note) {
    var noteP = document.createElement("p");
    noteP.className = "muted";
    noteP.style.fontStyle = "italic";
    noteP.style.margin = "10px 0 0";
    noteP.textContent = skill.note;
    card.appendChild(noteP);
  }

  if (skill.synergyNote) {
    var syn = document.createElement("div");
    syn.className = "synergy-card";
    syn.style.marginTop = "12px";
    syn.innerHTML = '<div><p class="synergy-label small-caps">Synergy</p><p class="synergy-text">' + escapeHtml(skill.synergyNote) + '</p></div>';
    card.appendChild(syn);
  }

  /* Roadmap — full CRUD, not just checkboxes */
  var roadmapHeader = document.createElement("p");
  roadmapHeader.className = "detail-section-header";
  roadmapHeader.textContent = "Roadmap";
  card.appendChild(roadmapHeader);

  var roadmapList = document.createElement("div");
  roadmapList.className = "roadmap-list";
  (skill.roadmap || []).forEach(function (item, idx) {
    roadmapList.appendChild(renderRoadmapRow(card, skillId, item, idx));
  });
  if (!(skill.roadmap || []).length) {
    var emptyRoadmap = document.createElement("p");
    emptyRoadmap.className = "muted";
    emptyRoadmap.textContent = "No subtopics yet — add the first one below.";
    roadmapList.appendChild(emptyRoadmap);
  }
  card.appendChild(roadmapList);

  var addRow = document.createElement("div");
  addRow.className = "roadmap-add-row";
  var addInput = document.createElement("input");
  addInput.type = "text";
  addInput.placeholder = "Add a subtopic\u2026";
  var addBtn = document.createElement("button");
  addBtn.className = "btn";
  addBtn.textContent = "Add";
  function commitAdd() {
    var v = addInput.value.trim();
    if (!v) return;
    skill.roadmap = skill.roadmap || [];
    skill.roadmap.push({ title: v, done: false });
    saveState();
    renderSkillDetail(card, skillId);
  }
  addBtn.addEventListener("click", commitAdd);
  addInput.addEventListener("keydown", function (e) { if (e.key === "Enter") commitAdd(); });
  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  card.appendChild(addRow);

  /* Unit history */
  var historyHeader = document.createElement("p");
  historyHeader.className = "detail-section-header";
  historyHeader.textContent = "Unit history";
  card.appendChild(historyHeader);

  var entries = state.log
    .filter(function (l) { return l.skillId === skillId; })
    .slice()
    .sort(function (a, b) { return b.ts - a.ts; });

  var historyList = document.createElement("div");
  historyList.className = "history-list";
  if (!entries.length) {
    var emptyP = document.createElement("p");
    emptyP.className = "muted";
    emptyP.textContent = "No logged units yet.";
    historyList.appendChild(emptyP);
  } else {
    entries.slice(0, 15).forEach(function (entry) {
      var source = state.sources.find(function (s) { return s.id === entry.sourceId; });
      var row = document.createElement("div");
      row.className = "history-row";
      var dateStr = new Date(entry.ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      row.innerHTML =
        '<div class="history-row-top"><span>' + capitalize(entry.unitType) + (source ? " \u00b7 " + escapeHtml(source.name) : "") + '</span>' +
        '<span style="color:var(--amber)">+' + entry.xpGranted + ' xp</span></div>' +
        '<div class="history-row-note small-caps">' + dateStr + (entry.quantity && entry.quantity !== 1 ? " \u00b7 \u00d7" + entry.quantity : "") + '</div>' +
        (entry.note ? '<div class="history-row-note">' + escapeHtml(entry.note) + '</div>' : '');
      historyList.appendChild(row);
    });
    if (entries.length > 15) {
      var moreP = document.createElement("p");
      moreP.className = "muted";
      moreP.style.marginTop = "6px";
      moreP.textContent = "+ " + (entries.length - 15) + " earlier entries";
      historyList.appendChild(moreP);
    }
  }
  card.appendChild(historyList);
}

function renderRoadmapRow(card, skillId, item, idx) {
  var row = document.createElement("div");
  row.className = "roadmap-row";

  var checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !!item.done;
  checkbox.setAttribute("aria-label", "Mark subtopic done");
  checkbox.addEventListener("change", function () {
    var state = getState();
    var skill = skillById(state, skillId);
    skill.roadmap[idx].done = checkbox.checked;
    recomputeSkillLevel(skill);
    saveState();
    renderSkillDetail(card, skillId);
  });
  row.appendChild(checkbox);

  var titleSpan = document.createElement("span");
  titleSpan.className = "roadmap-title " + (item.done ? "done" : "pending");
  titleSpan.textContent = item.title;
  row.appendChild(titleSpan);

  var editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.setAttribute("aria-label", "Rename subtopic");
  editBtn.textContent = "\u270e";
  editBtn.addEventListener("click", function () {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "roadmap-title-input";
    input.value = item.title;
    row.replaceChild(input, titleSpan);
    editBtn.style.display = "none";
    input.focus();
    input.select();
    function commit() {
      var v = input.value.trim();
      var state = getState();
      var skill = skillById(state, skillId);
      if (v) { skill.roadmap[idx].title = v; saveState(); }
      renderSkillDetail(card, skillId);
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") input.blur(); });
  });
  row.appendChild(editBtn);

  var delBtn = document.createElement("button");
  delBtn.className = "icon-btn";
  delBtn.setAttribute("aria-label", "Remove subtopic");
  delBtn.textContent = "\u00d7";
  delBtn.addEventListener("click", function () {
    var ok = confirm('Remove "' + item.title + '" from the roadmap?');
    if (!ok) return;
    var state = getState();
    var skill = skillById(state, skillId);
    skill.roadmap.splice(idx, 1);
    recomputeSkillLevel(skill);
    saveState();
    renderSkillDetail(card, skillId);
  });
  row.appendChild(delBtn);

  return row;
}
