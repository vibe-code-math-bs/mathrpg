/* ===== QUESTS.JS =====
   Phase F: the overarching narrative (design spec §8, handoff §4/§8, build-plan §5F).
   Top to bottom: main-quest banner (Bigelow Campaign) -> two parallel seal-timeline
   tracks (Spider / Surface) -> Bosses -> Foci management (add/edit/archive) ->
   Bounty board (2-col card grid, add/check-off/convert-to-log).

   Seal glyph states are DERIVED, not stored: a step's stored shape is only
   { step, done }, so "in progress" = the first not-done step in a track, "available"
   = every not-done step after that. No gating either way — every step is always
   editable/toggleable; "available" just means "not the current one," never "locked."

   DEVIATION (flagged, not silently done): the handoff's §8 prose says completing a
   campaign step "grants Mastery to the relevant diagrammatic skill + stats as
   appropriate." The pinned data model (§11) gives campaign steps no skillId/stat
   link to drive that from, and re-deriving a second XP-granting pathway outside
   log.js's single fan-out (mathrpg-build-plan.md §4) risked a second, divergent
   source of truth for XP. Campaign steps and Bosses are therefore narrative
   checkboxes only, same tier as Bosses — real Mastery/XP still only comes from
   actually logging units (e.g. against a bounty, or a focus). Flagging here so a
   future session can revisit if a direct link is wanted.

   log.js touched minimally (one addition, see the PHASE F comment there): a bounty's
   "Log" button prefills openLogModal with { ..., bountyId }, and a successful save
   now checks that bounty off automatically — the "convert into a log entry" half of
   handoff §4's "check off, or convert a bounty into a log entry." Manual check-off
   (the other half) is a direct toggle on the bounty card and never touches log.js.

   Small helpers duplicated here per build-plan §1's one-file-per-screen convention:
   escapeHtml, buildCloseButton (identical to skills.js's copies). questSlug/
   uniqueQuestId are NOT named slugify/uniqueSkillId on purpose — skills.js's globals
   of those names are used elsewhere and script tags share one global scope (not
   modules), so reusing the exact name would silently overwrite them. */

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function buildCloseButton(onClose) {
  var btn = document.createElement("button");
  btn.className = "modal-close";
  btn.setAttribute("aria-label", "Close");
  btn.innerHTML = "&times;";
  btn.addEventListener("click", onClose);
  return btn;
}

function questSlug(str, fallback) {
  return (str || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function uniqueQuestId(list, base) {
  var id = base, n = 2;
  while (list.some(function (item) { return item.id === id; })) {
    id = base + "-" + n;
    n++;
  }
  return id;
}

/* ---------- Screen: Quests ---------- */

function renderQuests() {
  var state = getState();
  var wrap = document.createElement("div");
  wrap.className = "quests-wrap";

  wrap.appendChild(renderMainQuestBanner());
  wrap.appendChild(renderCampaignTrack(state, "spiderTrack", "Spider track"));
  wrap.appendChild(renderCampaignTrack(state, "surfaceTrack", "Surface track"));
  wrap.appendChild(renderBossesCard(state));
  wrap.appendChild(renderFociSection(state));
  wrap.appendChild(renderBountySection(state));

  return wrap;
}

/* ---------- ① Main-quest banner ---------- */

function renderMainQuestBanner() {
  var box = document.createElement("div");
  box.className = "quest-banner";
  box.innerHTML =
    '<p class="quest-banner-eyebrow small-caps">Main quest</p>' +
    '<p class="quest-banner-title">The Bigelow Campaign</p>' +
    '<p class="quest-banner-desc">A forked arc into the diagrammatic-algebra frontier \u2014 ' +
    'the systematic Spider track and the experimental Surface track. Advance whichever calls.</p>';
  return box;
}

/* ---------- ② Two parallel track seal-timelines ----------
   Seal glyph (46px, design spec §8): complete = full amber ring + filled amber disc +
   chalk checkmark; in progress = partial celadon arc (fixed at a representative 55% —
   there's no literal sub-progress on a milestone, this is a "current" marker, not a
   measured fraction) + a lighter celadon disc; available = a dim rule-only ring, no
   disc — never a padlock, every step stays tappable. Required bugfix from the skill
   glyph carries over here too: rotate the arc via the SVG transform attribute, paired
   with pathLength="100". */

function campaignStepStatus(track, idx) {
  if (track[idx].done) return "complete";
  var firstUndone = -1;
  for (var i = 0; i < track.length; i++) {
    if (!track[i].done) { firstUndone = i; break; }
  }
  return idx === firstUndone ? "in-progress" : "available";
}

function buildSealGlyph(status) {
  if (status === "complete") {
    return (
      '<svg viewBox="0 0 46 46" width="46" height="46" class="seal-glyph" aria-hidden="true">' +
      '<circle cx="23" cy="23" r="18" fill="none" stroke="var(--amber)" stroke-width="2.5"/>' +
      '<circle cx="23" cy="23" r="12" fill="var(--amber)" opacity="0.5"/>' +
      '<path d="M16.5 23.5 L20.5 27.5 L29.5 17.5" fill="none" stroke="var(--chalk)" ' +
      'stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }
  if (status === "in-progress") {
    return (
      '<svg viewBox="0 0 46 46" width="46" height="46" class="seal-glyph" aria-hidden="true">' +
      '<circle cx="23" cy="23" r="18" fill="none" stroke="var(--rule)" stroke-width="2.5" pathLength="100"/>' +
      '<circle cx="23" cy="23" r="18" fill="none" stroke="var(--celadon)" stroke-width="2.5" ' +
      'stroke-linecap="round" pathLength="100" stroke-dasharray="55 100" transform="rotate(-90 23 23)"/>' +
      '<circle cx="23" cy="23" r="9" fill="var(--celadon)" opacity="0.45"/>' +
      '</svg>'
    );
  }
  return (
    '<svg viewBox="0 0 46 46" width="46" height="46" class="seal-glyph" aria-hidden="true">' +
    '<circle cx="23" cy="23" r="18" fill="none" stroke="var(--rule)" stroke-width="2.5"/>' +
    '</svg>'
  );
}

function renderCampaignTrack(state, trackKey, trackLabel) {
  var track = state.campaign[trackKey] || [];
  var card = document.createElement("div");
  card.className = "card track-card";

  var header = document.createElement("div");
  header.className = "card-header";
  var doneCount = track.filter(function (s) { return s.done; }).length;
  header.innerHTML =
    '<span class="small-caps">' + escapeHtml(trackLabel) + '</span>' +
    '<span class="track-meter small-caps">' + doneCount + ' / ' + track.length + '</span>';
  card.appendChild(header);

  var timeline = document.createElement("div");
  timeline.className = "timeline";
  if (!track.length) {
    var emptyP = document.createElement("p");
    emptyP.className = "muted";
    emptyP.textContent = "No milestones yet \u2014 add the first one below.";
    timeline.appendChild(emptyP);
  } else {
    track.forEach(function (step, idx) {
      timeline.appendChild(renderTimelineRow(state, track, step, idx));
    });
  }
  card.appendChild(timeline);

  var addRow = document.createElement("div");
  addRow.className = "roadmap-add-row";
  var addInput = document.createElement("input");
  addInput.type = "text";
  addInput.placeholder = "Add a milestone\u2026";
  var addBtn = document.createElement("button");
  addBtn.className = "btn";
  addBtn.textContent = "Add";
  function commitAdd() {
    var v = addInput.value.trim();
    if (!v) return;
    track.push({ step: v, done: false });
    saveState();
    refreshCurrentScreen();
  }
  addBtn.addEventListener("click", commitAdd);
  addInput.addEventListener("keydown", function (e) { if (e.key === "Enter") commitAdd(); });
  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  card.appendChild(addRow);

  return card;
}

function renderTimelineRow(state, track, step, idx) {
  var status = campaignStepStatus(track, idx);
  var row = document.createElement("div");
  row.className = "timeline-row";

  var sealBtn = document.createElement("button");
  sealBtn.type = "button";
  sealBtn.className = "timeline-seal-col";
  sealBtn.setAttribute("aria-label", step.done ? "Mark milestone not done" : "Mark milestone done");
  sealBtn.innerHTML = buildSealGlyph(status);
  sealBtn.addEventListener("click", function () {
    step.done = !step.done;
    saveState();
    refreshCurrentScreen();
  });
  if (idx < track.length - 1) {
    var thread = document.createElement("div");
    thread.className = "timeline-thread";
    sealBtn.appendChild(thread);
  }
  row.appendChild(sealBtn);

  var text = document.createElement("div");
  text.className = "timeline-text";

  var titleRow = document.createElement("div");
  titleRow.className = "timeline-title-row";
  var titleSpan = document.createElement("span");
  titleSpan.className = "timeline-title";
  titleSpan.textContent = step.step;
  titleRow.appendChild(titleSpan);

  var editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.setAttribute("aria-label", "Rename milestone");
  editBtn.textContent = "\u270e";
  editBtn.addEventListener("click", function () {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "timeline-title-input";
    input.value = step.step;
    titleRow.replaceChild(input, titleSpan);
    editBtn.style.display = "none";
    input.focus();
    input.select();
    function commit() {
      var v = input.value.trim();
      if (v) { step.step = v; saveState(); }
      refreshCurrentScreen();
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") input.blur(); });
  });
  titleRow.appendChild(editBtn);

  var delBtn = document.createElement("button");
  delBtn.className = "icon-btn";
  delBtn.setAttribute("aria-label", "Remove milestone");
  delBtn.textContent = "\u00d7";
  delBtn.addEventListener("click", function () {
    var ok = confirm('Remove "' + step.step + '" from this track?');
    if (!ok) return;
    var i = track.indexOf(step);
    if (i !== -1) track.splice(i, 1);
    saveState();
    refreshCurrentScreen();
  });
  titleRow.appendChild(delBtn);

  text.appendChild(titleRow);

  var statusLine = document.createElement("p");
  var statusClass = "status-" + status;
  statusLine.className = "timeline-status small-caps " + statusClass;
  statusLine.textContent = status === "in-progress" ? "in progress" : status;
  text.appendChild(statusLine);

  row.appendChild(text);
  return row;
}

/* ---------- ③ Bosses ----------
   "Simple rows with a small-caps status and a check action" per design spec §8.3 —
   deliberately no add/rename/remove here (unlike the two tracks and the bounty board,
   Bosses aren't in build-plan §2.5's customization list). */

function renderBossesCard(state) {
  var bosses = state.campaign.bosses || [];
  var card = document.createElement("div");
  card.className = "card";

  var doneCount = bosses.filter(function (b) { return b.done; }).length;
  var header = document.createElement("div");
  header.className = "card-header";
  header.innerHTML =
    '<span class="small-caps">Bosses</span>' +
    '<span class="track-meter small-caps">' + doneCount + ' / ' + bosses.length + '</span>';
  card.appendChild(header);

  bosses.forEach(function (boss) {
    var row = document.createElement("label");
    row.className = "row boss-row";

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!boss.done;
    checkbox.addEventListener("change", function () {
      boss.done = checkbox.checked;
      saveState();
      refreshCurrentScreen();
    });
    row.appendChild(checkbox);

    var text = document.createElement("span");
    text.className = "boss-row-text" + (boss.done ? " done" : "");
    text.textContent = boss.step;
    row.appendChild(text);

    var status = document.createElement("span");
    status.className = "small-caps " + (boss.done ? "status-ok" : "muted");
    status.textContent = boss.done ? "done" : "open";
    row.appendChild(status);

    card.appendChild(row);
  });

  return card;
}

/* ---------- ④ Foci management ----------
   Today's "foci due now" card (today.js) is the read-only quick-log surface; this is
   the full CRUD surface (handoff §4/§9④, build-plan §2.5): add / edit / archive,
   plus a restore path for anything archived (archiving without a way back would be a
   one-way door the spec never actually asks for). Cadence-state math is duplicated
   locally from today.js/log.js per the file-local convention rather than shared. */

var QUEST_FOCUS_CADENCE_DAYS = { daily: 1, "semi-weekly": 3.5, weekly: 7, custom: 7 };

function questFocusState(focus) {
  if (!focus.lastMet) return "due";
  var cadenceMs = (QUEST_FOCUS_CADENCE_DAYS[focus.cadence] || 7) * 24 * 60 * 60 * 1000;
  return (Date.now() - focus.lastMet) < cadenceMs ? "met" : "due";
}

function renderFociSection(state) {
  var card = document.createElement("div");
  card.className = "card";

  var active = state.foci.filter(function (f) { return f.active; });
  var archived = state.foci.filter(function (f) { return !f.active; });

  var header = document.createElement("div");
  header.className = "card-header";
  header.innerHTML =
    '<span class="small-caps">Foci</span>' +
    '<span class="track-meter small-caps">' + active.length + ' active</span>';
  card.appendChild(header);

  if (!active.length) {
    var emptyP = document.createElement("p");
    emptyP.className = "muted";
    emptyP.textContent = "No active foci \u2014 add one below.";
    card.appendChild(emptyP);
  } else {
    active.forEach(function (focus) {
      card.appendChild(renderFocusManageRow(state, focus));
    });
  }

  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-skill-card small-caps";
  addBtn.style.marginTop = "10px";
  addBtn.style.marginBottom = "0";
  addBtn.textContent = "+ Add a focus";
  addBtn.addEventListener("click", function () { openFocusModal(null); });
  card.appendChild(addBtn);

  if (archived.length) {
    var archHeader = document.createElement("p");
    archHeader.className = "detail-section-header";
    archHeader.textContent = "Archived (" + archived.length + ")";
    card.appendChild(archHeader);
    archived.forEach(function (focus) {
      card.appendChild(renderArchivedFocusRow(focus));
    });
  }

  return card;
}

function renderFocusManageRow(state, focus) {
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
  var st = questFocusState(focus);
  left.innerHTML =
    '<p class="focus-name">' + escapeHtml(focus.name) +
    ' <span class="focus-state state-' + st + ' small-caps">' + st + '</span></p>' +
    '<p class="focus-sub small-caps">' + (skill ? escapeHtml(skill.name) + " \u00b7 " : "") +
    escapeHtml(focus.cadence) + (focus.streak ? " \u00b7 streak " + focus.streak : "") + '</p>' +
    (focus.note ? '<p class="focus-note">' + escapeHtml(focus.note) + '</p>' : '');
  row.appendChild(left);

  var actions = document.createElement("div");
  actions.className = "focus-row-actions";

  var logBtn = document.createElement("button");
  logBtn.type = "button";
  logBtn.className = "btn quick-log-btn";
  logBtn.textContent = "Log";
  logBtn.addEventListener("click", function () {
    if (typeof openLogModal === "function") {
      openLogModal({ unitType: focus.defaultUnitType, skillId: focus.skillId });
    }
  });
  actions.appendChild(logBtn);

  var editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.setAttribute("aria-label", "Edit focus");
  editBtn.textContent = "\u270e";
  editBtn.addEventListener("click", function () { openFocusModal(focus); });
  actions.appendChild(editBtn);

  var archiveBtn = document.createElement("button");
  archiveBtn.className = "icon-btn";
  archiveBtn.setAttribute("aria-label", "Archive focus");
  archiveBtn.textContent = "\u23f8";
  archiveBtn.addEventListener("click", function () {
    focus.active = false;
    saveState();
    refreshCurrentScreen();
  });
  actions.appendChild(archiveBtn);

  row.appendChild(actions);
  return row;
}

function renderArchivedFocusRow(focus) {
  var row = document.createElement("div");
  row.className = "row";
  var left = document.createElement("span");
  left.className = "muted";
  left.textContent = focus.name;
  row.appendChild(left);
  var restoreBtn = document.createElement("button");
  restoreBtn.className = "btn";
  restoreBtn.textContent = "Restore";
  restoreBtn.addEventListener("click", function () {
    focus.active = true;
    saveState();
    refreshCurrentScreen();
  });
  row.appendChild(restoreBtn);
  return row;
}

/* ---------- Focus modal (add / edit, one form for both) ---------- */

function openFocusModal(existingFocus) {
  if (document.getElementById("focus-modal-overlay")) return;
  var state = getState();
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "focus-modal-overlay";
  var card = document.createElement("div");
  card.className = "modal-card";
  overlay.appendChild(card);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeFocusModal(); });
  document.addEventListener("keydown", _focusModalEscListener);
  document.body.appendChild(overlay);
  renderFocusForm(card, state, existingFocus);
}

function _focusModalEscListener(e) { if (e.key === "Escape") closeFocusModal(); }

function closeFocusModal() {
  var overlay = document.getElementById("focus-modal-overlay");
  if (overlay) overlay.remove();
  document.removeEventListener("keydown", _focusModalEscListener);
  refreshCurrentScreen();
}

function renderFocusForm(card, state, existingFocus) {
  card.innerHTML = "";
  card.appendChild(buildCloseButton(closeFocusModal));

  var isEdit = !!existingFocus;
  var eyebrow = document.createElement("p");
  eyebrow.className = "modal-eyebrow small-caps";
  eyebrow.textContent = isEdit ? "Edit focus" : "New focus";
  card.appendChild(eyebrow);

  var title = document.createElement("p");
  title.className = "modal-title";
  title.textContent = isEdit ? "Edit a cadence commitment" : "Commit to a cadence";
  card.appendChild(title);

  var form = {
    name: isEdit ? existingFocus.name : "",
    cadence: isEdit ? existingFocus.cadence : "weekly",
    skillId: isEdit ? existingFocus.skillId : (state.skills[0] && state.skills[0].id),
    defaultUnitType: isEdit ? existingFocus.defaultUnitType : "notes",
    note: isEdit ? (existingFocus.note || "") : ""
  };

  var nameField = document.createElement("div");
  nameField.className = "log-field";
  nameField.innerHTML = '<label class="field-label">Name</label>';
  var nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "e.g. Ergodic paper \u2014 final tightening";
  nameInput.value = form.name;
  nameInput.addEventListener("input", function () { form.name = nameInput.value; updateSaveEnabled(); });
  nameField.appendChild(nameInput);
  card.appendChild(nameField);

  var skillField = document.createElement("div");
  skillField.className = "log-field";
  skillField.innerHTML = '<label class="field-label">Skill</label>';
  var skillSelect = document.createElement("select");
  state.skills.forEach(function (s) {
    var opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    if (s.id === form.skillId) opt.selected = true;
    skillSelect.appendChild(opt);
  });
  skillSelect.addEventListener("change", function () { form.skillId = skillSelect.value; });
  skillField.appendChild(skillSelect);
  card.appendChild(skillField);

  var utField = document.createElement("div");
  utField.className = "log-field";
  utField.innerHTML = '<label class="field-label">Default unit type</label>';
  var utSelect = document.createElement("select");
  UNIT_TYPE_INFO.forEach(function (ut) {
    var opt = document.createElement("option");
    opt.value = ut.key;
    opt.textContent = ut.name;
    if (ut.key === form.defaultUnitType) opt.selected = true;
    utSelect.appendChild(opt);
  });
  utSelect.addEventListener("change", function () { form.defaultUnitType = utSelect.value; });
  utField.appendChild(utSelect);
  card.appendChild(utField);

  var cadField = document.createElement("div");
  cadField.className = "log-field";
  cadField.innerHTML = '<label class="field-label">Cadence</label>';
  var cadSelect = document.createElement("select");
  [["daily", "Daily"], ["semi-weekly", "Semi-weekly (~3\u20134 days)"], ["weekly", "Weekly"], ["custom", "Custom"]]
    .forEach(function (pair) {
      var opt = document.createElement("option");
      opt.value = pair[0];
      opt.textContent = pair[1];
      if (pair[0] === form.cadence) opt.selected = true;
      cadSelect.appendChild(opt);
    });
  cadSelect.addEventListener("change", function () { form.cadence = cadSelect.value; });
  cadField.appendChild(cadSelect);
  card.appendChild(cadField);

  var noteField = document.createElement("div");
  noteField.className = "log-field";
  noteField.innerHTML = '<label class="field-label">Note (optional)</label>';
  var noteInput = document.createElement("textarea");
  noteInput.value = form.note;
  noteInput.addEventListener("input", function () { form.note = noteInput.value; });
  noteField.appendChild(noteInput);
  card.appendChild(noteField);

  var saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.style.width = "100%";
  saveBtn.textContent = isEdit ? "Save changes" : "Create focus";
  card.appendChild(saveBtn);

  function updateSaveEnabled() {
    saveBtn.disabled = !(form.name.trim().length > 0 && form.skillId);
  }
  updateSaveEnabled();

  saveBtn.addEventListener("click", function () {
    if (!(form.name.trim().length > 0 && form.skillId)) return;
    if (isEdit) {
      existingFocus.name = form.name.trim();
      existingFocus.cadence = form.cadence;
      existingFocus.skillId = form.skillId;
      existingFocus.defaultUnitType = form.defaultUnitType;
      existingFocus.note = form.note;
    } else {
      state.foci.push({
        id: uniqueQuestId(state.foci, "focus-" + questSlug(form.name, "focus")),
        name: form.name.trim(),
        cadence: form.cadence,
        skillId: form.skillId,
        defaultUnitType: form.defaultUnitType,
        note: form.note,
        active: true,
        lastMet: null,
        streak: 0
      });
    }
    saveState();
    closeFocusModal();
  });

  if (isEdit) {
    var delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger";
    delBtn.style.width = "100%";
    delBtn.style.marginTop = "10px";
    delBtn.textContent = "Delete focus";
    delBtn.addEventListener("click", function () {
      var ok = confirm('Delete "' + existingFocus.name + '"? This can\'t be undone.');
      if (!ok) return;
      var i = state.foci.indexOf(existingFocus);
      if (i !== -1) state.foci.splice(i, 1);
      saveState();
      closeFocusModal();
    });
    card.appendChild(delBtn);
  }
}

/* ---------- ⑤ Bounty board ----------
   2-col card grid (design spec §8.5, reuses skills.js's .skill-grid layout, no glyph
   needed). Each card: status pill, title, tier + target-skill line, an amber reward-
   preview line (UNIT_BASE_XP x TIER_WEIGHTS at quantity 1, from core.js — a preview,
   not what's actually granted, since the real grant depends on the source picked at
   log time). "Check off" toggles done directly; "Log" opens the Log modal prefilled
   with { unitType, skillId, bountyId } — log.js's PHASE F addition marks the bounty
   done automatically on a successful save. */

function renderBountySection(state) {
  var wrap = document.createElement("div");

  var openCount = state.bounties.filter(function (b) { return !b.done; }).length;
  var headerRow = document.createElement("div");
  headerRow.className = "branch-header-row";
  headerRow.innerHTML =
    '<span class="branch-name">Bounty board</span>' +
    '<span class="branch-meter small-caps">' + openCount + ' open</span>';
  wrap.appendChild(headerRow);

  if (!state.bounties.length) {
    var emptyP = document.createElement("p");
    emptyP.className = "muted";
    emptyP.textContent = "No bounties yet \u2014 add one below.";
    wrap.appendChild(emptyP);
  } else {
    var grid = document.createElement("div");
    grid.className = "skill-grid bounty-grid";
    state.bounties.forEach(function (bounty) {
      grid.appendChild(renderBountyCard(state, bounty));
    });
    wrap.appendChild(grid);
  }

  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-skill-card small-caps";
  addBtn.textContent = "+ Add a bounty";
  addBtn.addEventListener("click", function () { openBountyModal(); });
  wrap.appendChild(addBtn);

  return wrap;
}

function renderBountyCard(state, bounty) {
  var skill = skillById(state, bounty.skillId);
  var card = document.createElement("div");
  card.className = "bounty-card";

  var statusPill = document.createElement("span");
  statusPill.className = "pill small-caps " + (bounty.done ? "pill-dim" : "pill-celadon");
  statusPill.textContent = bounty.done ? "done" : "open";
  card.appendChild(statusPill);

  var titleP = document.createElement("p");
  titleP.className = "bounty-title" + (bounty.done ? " done" : "");
  titleP.textContent = bounty.title;
  card.appendChild(titleP);

  var subP = document.createElement("p");
  subP.className = "bounty-sub small-caps";
  subP.textContent = TIER_LABELS[bounty.tier] + (skill ? " \u00b7 " + skill.name : "");
  card.appendChild(subP);

  var xp = Math.round((UNIT_BASE_XP[bounty.suggestedUnitType] || 0) * (TIER_WEIGHTS[bounty.tier] || 1));
  var statPair = UNIT_STAT_MAP[bounty.suggestedUnitType] || [];
  var rewardP = document.createElement("p");
  rewardP.className = "bounty-reward small-caps";
  rewardP.textContent = "+" + xp + " xp \u00b7 " + statPair.map(function (k) { return STAT_LABELS[k]; }).join(" + ");
  card.appendChild(rewardP);

  var actions = document.createElement("div");
  actions.className = "bounty-actions";

  var toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "btn";
  toggleBtn.textContent = bounty.done ? "Reopen" : "Check off";
  toggleBtn.addEventListener("click", function () {
    bounty.done = !bounty.done;
    saveState();
    refreshCurrentScreen();
  });
  actions.appendChild(toggleBtn);

  if (!bounty.done) {
    var logBtn = document.createElement("button");
    logBtn.type = "button";
    logBtn.className = "btn btn-primary";
    logBtn.textContent = "Log";
    logBtn.addEventListener("click", function () {
      if (typeof openLogModal === "function") {
        openLogModal({ unitType: bounty.suggestedUnitType, skillId: bounty.skillId, bountyId: bounty.id });
      }
    });
    actions.appendChild(logBtn);
  }
  card.appendChild(actions);

  var delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "icon-btn bounty-remove";
  delBtn.setAttribute("aria-label", "Remove bounty");
  delBtn.textContent = "\u00d7";
  delBtn.addEventListener("click", function () {
    var ok = confirm('Remove "' + bounty.title + '"?');
    if (!ok) return;
    var i = state.bounties.indexOf(bounty);
    if (i !== -1) state.bounties.splice(i, 1);
    saveState();
    refreshCurrentScreen();
  });
  card.appendChild(delBtn);

  return card;
}

/* ---------- Add Bounty modal ---------- */

function openBountyModal() {
  if (document.getElementById("bounty-modal-overlay")) return;
  var state = getState();
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "bounty-modal-overlay";
  var card = document.createElement("div");
  card.className = "modal-card";
  overlay.appendChild(card);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeBountyModal(); });
  document.addEventListener("keydown", _bountyModalEscListener);
  document.body.appendChild(overlay);
  renderBountyForm(card, state);
}

function _bountyModalEscListener(e) { if (e.key === "Escape") closeBountyModal(); }

function closeBountyModal() {
  var overlay = document.getElementById("bounty-modal-overlay");
  if (overlay) overlay.remove();
  document.removeEventListener("keydown", _bountyModalEscListener);
  refreshCurrentScreen();
}

function renderBountyForm(card, state) {
  card.innerHTML = "";
  card.appendChild(buildCloseButton(closeBountyModal));

  var eyebrow = document.createElement("p");
  eyebrow.className = "modal-eyebrow small-caps";
  eyebrow.textContent = "New bounty";
  card.appendChild(eyebrow);

  var title = document.createElement("p");
  title.className = "modal-title";
  title.textContent = "Add a bounty";
  card.appendChild(title);

  var form = {
    title: "",
    skillId: state.skills[0] && state.skills[0].id,
    suggestedUnitType: "exercise",
    tier: "undergrad"
  };

  var titleField = document.createElement("div");
  titleField.className = "log-field";
  titleField.innerHTML = '<label class="field-label">Bounty title</label>';
  var titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "e.g. Prove Urysohn's Lemma";
  titleInput.addEventListener("input", function () { form.title = titleInput.value; updateSaveEnabled(); });
  titleField.appendChild(titleInput);
  card.appendChild(titleField);

  var skillField = document.createElement("div");
  skillField.className = "log-field";
  skillField.innerHTML = '<label class="field-label">Target skill</label>';
  var skillSelect = document.createElement("select");
  state.skills.forEach(function (s) {
    var opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    skillSelect.appendChild(opt);
  });
  skillSelect.addEventListener("change", function () { form.skillId = skillSelect.value; });
  skillField.appendChild(skillSelect);
  card.appendChild(skillField);

  var utField = document.createElement("div");
  utField.className = "log-field";
  utField.innerHTML = '<label class="field-label">Suggested unit type</label>';
  var utSelect = document.createElement("select");
  UNIT_TYPE_INFO.forEach(function (ut) {
    var opt = document.createElement("option");
    opt.value = ut.key;
    opt.textContent = ut.name;
    if (ut.key === "exercise") opt.selected = true;
    utSelect.appendChild(opt);
  });
  utSelect.addEventListener("change", function () { form.suggestedUnitType = utSelect.value; });
  utField.appendChild(utSelect);
  card.appendChild(utField);

  var tierField = document.createElement("div");
  tierField.className = "log-field";
  tierField.innerHTML = '<label class="field-label">Tier</label>';
  var tierSelect = document.createElement("select");
  Object.keys(TIER_LABELS).forEach(function (k) {
    var opt = document.createElement("option");
    opt.value = k;
    opt.textContent = TIER_LABELS[k];
    if (k === "undergrad") opt.selected = true;
    tierSelect.appendChild(opt);
  });
  tierSelect.addEventListener("change", function () { form.tier = tierSelect.value; });
  tierField.appendChild(tierSelect);
  card.appendChild(tierField);

  var saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.style.width = "100%";
  saveBtn.textContent = "Add bounty";
  card.appendChild(saveBtn);

  function updateSaveEnabled() {
    saveBtn.disabled = !(form.title.trim().length > 0 && form.skillId);
  }
  updateSaveEnabled();

  saveBtn.addEventListener("click", function () {
    if (!(form.title.trim().length > 0 && form.skillId)) return;
    state.bounties.push({
      id: uniqueQuestId(state.bounties, "bounty-" + questSlug(form.title, "bounty")),
      title: form.title.trim(),
      skillId: form.skillId,
      suggestedUnitType: form.suggestedUnitType,
      tier: form.tier,
      done: false
    });
    saveState();
    closeBountyModal();
  });
}
