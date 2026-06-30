/* ===== SETTINGS.JS =====
   Phase A: Export / Import / Reset are the load-bearing pieces (the user's only
   safety net). Sources & tiers + decay tuning are included too since the design
   spec puts the whole Settings screen in one idiom and the data already exists.
   Reached via the top-bar gear, not a tab slot. */

function renderSettings() {
  const state = getState();
  const wrap = document.createElement("div");

  wrap.appendChild(renderBackupCard());
  wrap.appendChild(renderSourcesCard(state));
  wrap.appendChild(renderDecayCard(state));
  wrap.appendChild(renderDangerCard());

  return wrap;
}

function renderBackupCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML =
    '<p class="card-header small-caps">Backup</p>' +
    '<p class="muted" style="margin-top:0">Your only safety net against a cleared browser. Export often.</p>' +
    '<div class="btn-row" style="margin-top:10px">' +
    '  <button class="btn btn-primary" id="btn-export">Export JSON</button>' +
    '  <button class="btn" id="btn-import">Import JSON</button>' +
    '</div>' +
    '<input type="file" id="file-import" accept="application/json">' +
    '<p class="status-msg" id="backup-status"></p>';

  card.querySelector("#btn-export").addEventListener("click", function () {
    exportStateToFile();
    showStatus(card.querySelector("#backup-status"), "Exported.", true);
  });

  const fileInput = card.querySelector("#file-import");
  card.querySelector("#btn-import").addEventListener("click", function () {
    fileInput.click();
  });
  fileInput.addEventListener("change", function () {
    const file = fileInput.files[0];
    if (!file) return;
    const ok = confirm("Importing replaces all current data with the backup file. Continue?");
    if (!ok) { fileInput.value = ""; return; }
    importStateFromFile(file, function (success, errMsg) {
      const statusEl = card.querySelector("#backup-status");
      if (success) {
        showStatus(statusEl, "Imported. Reloading screens…", true);
        navigate("settings");
      } else {
        showStatus(statusEl, "Import failed: " + errMsg, false);
      }
      fileInput.value = "";
    });
  });

  return card;
}

function renderSourcesCard(state) {
  const card = document.createElement("div");
  card.className = "card";
  const header = document.createElement("p");
  header.className = "card-header small-caps";
  header.textContent = "Sources & tiers";
  card.appendChild(header);

  const list = document.createElement("div");
  state.sources.forEach(function (source) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML =
      '<span style="flex:1">' + escapeHtml(source.name) + '</span>';
    const select = document.createElement("select");
    select.style.width = "auto";
    Object.keys(TIER_WEIGHTS).forEach(function (tierKey) {
      const opt = document.createElement("option");
      opt.value = tierKey;
      opt.textContent = TIER_LABELS[tierKey];
      if (source.tier === tierKey) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", function () {
      source.tier = select.value;
      saveState();
    });
    row.appendChild(select);
    list.appendChild(row);
  });
  card.appendChild(list);

  const addRow = document.createElement("div");
  addRow.style.marginTop = "10px";
  addRow.innerHTML =
    '<label class="field-label">Add a source</label>' +
    '<div style="display:flex; gap:8px">' +
    '  <input type="text" id="new-source-name" placeholder="Source name" style="flex:1">' +
    '  <button class="btn" id="btn-add-source" style="flex:0 0 auto">Add</button>' +
    '</div>';
  card.appendChild(addRow);

  addRow.querySelector("#btn-add-source").addEventListener("click", function () {
    const input = addRow.querySelector("#new-source-name");
    const name = input.value.trim();
    if (!name) return;
    state.sources.push({
      id: "src-" + Date.now(),
      name: name,
      tier: "undergrad" // new sources default to Undergrad, per spec
    });
    saveState();
    navigate("settings");
  });

  return card;
}

function renderDecayCard(state) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML =
    '<p class="card-header small-caps">Decay tuning</p>' +
    '<div style="display:flex; gap:12px; flex-wrap:wrap">' +
    '  <div style="flex:1; min-width:140px">' +
    '    <label class="field-label">Decay rate per week (%)</label>' +
    '    <input type="number" id="decay-rate" min="0" max="100" step="0.5" value="' +
            (state.settings.decayRatePerWeek * 100) + '">' +
    '  </div>' +
    '  <div style="flex:1; min-width:140px">' +
    '    <label class="field-label">Grace window (days)</label>' +
    '    <input type="number" id="grace-window" min="0" step="1" value="' +
            state.settings.graceWindowDays + '">' +
    '  </div>' +
    '</div>' +
    '<p class="muted" style="margin-top:8px">Applies only to maintenance-flagged (GRE/foundations) skills.</p>';

  card.querySelector("#decay-rate").addEventListener("change", function (e) {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v >= 0) {
      state.settings.decayRatePerWeek = v / 100;
      saveState();
    }
  });
  card.querySelector("#grace-window").addEventListener("change", function (e) {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 0) {
      state.settings.graceWindowDays = v;
      saveState();
    }
  });

  return card;
}

function renderDangerCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML =
    '<p class="card-header small-caps">Reset</p>' +
    '<div class="danger-row">' +
    '  <span class="muted">Clear all data and restart from the seed tree.</span>' +
    '  <button class="btn btn-danger" id="btn-reset">Reset</button>' +
    '</div>';

  card.querySelector("#btn-reset").addEventListener("click", function () {
    const ok1 = confirm("This permanently deletes all logged progress and restores the seed tree. Continue?");
    if (!ok1) return;
    const ok2 = confirm("Are you sure? Export a backup first if you're not certain.");
    if (!ok2) return;
    resetState(function () {
      navigate("settings");
    });
  });

  return card;
}

/* ---------- helpers ---------- */

function showStatus(el, msg, ok) {
  el.textContent = msg;
  el.className = "status-msg " + (ok ? "status-ok" : "status-err");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
