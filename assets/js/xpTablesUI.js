// xpTablesUI.js

const XPTablesUI = {
  xpData: null,

  async init(jsonPath) {
    try {
      const response = await fetch(`${jsonPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load XP tables data: ${response.status}`);
      }

      this.xpData = await response.json();
      XPTablesEngine.loadXPData(this.xpData);

      this.bindEvents();
      this.initTimer();
      this.displayUserChoiceAdvancements();
      this.renderSkillRoller();
      this.displaySkillTables();
      this.displayRandomAdvancementsTable();
      this.renderSkillsReferenceTable();

      // Expose test functions to window for console testing
      window.testAdvancement = (roll) => {
        const result = XPTablesEngine.testRoll(roll);
        if (result) {
          this.displayAdvancementResult(result);
          console.log('Test advancement result for roll ' + roll + ':', result);
        }
      };

      window.testSkillTable = (skillTableName, roll = null) => {
        const result = XPTablesEngine.testSkillTable(skillTableName, roll);
        if (result && !result.error) {
          this.displaySkillResult(result);
          console.log('Test skill table result:', result);
        } else if (result && result.error) {
          console.error(result.error);
        }
      };

      console.log('%c⚡ XP Tables Testing Enabled', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
      console.log('Use: testAdvancement(roll) - e.g., testAdvancement(7)');
      console.log('Use: testSkillTable(tableName, roll) - e.g., testSkillTable("skill_agility", 3) or testSkillTable("skill_combat")');
    } catch (err) {
      console.error(err);
      const container = document.getElementById("xp-tables-container");
      if (container) {
        container.innerHTML = '<div class="error-box">Error loading XP tables data.</div>';
      }
    }
  },

  bindEvents() {
    const button = document.getElementById("roll-advancement");
    if (button) {
      button.addEventListener("click", () => this.rollAdvancement());
    }
  },

  initTimer() {
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.init('page-roll-info', 'xpTablesLastRun');
      TimerUtil.setupPageCleanup();
    }
  },

  displayUserChoiceAdvancements() {
    const container = document.getElementById("user-choice-advancements");
    if (!container || !this.xpData.advancements_userchoice) return;

    const rows = Object.entries(this.xpData.advancements_userchoice).map(([key, data]) => {
      const rating = data.ratingIncrease !== null ? `+${data.ratingIncrease}` : 'n/a';
      const buttonRow = data.sides
        ? `<tr class="skill-button-row"><td colspan="3" class="text-center"><button class="btn-small">Roll for Skill</button></td></tr>`
        : '';
      return `<tr><td>${data.cost}</td><td>${data.advancement}</td><td>${rating}</td></tr>${buttonRow}`;
    }).join('');

    container.innerHTML = `
      <h2 class="mb-15">Leaders, Champions, Brutes, Prospects, Juves, Specialists (XP Spend)</h2>
      <table class="advancement-table">
        <thead><tr><th>Cost</th><th>Advancement</th><th>Rating Increase</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    container.querySelectorAll('.btn-small').forEach(btn => {
      btn.addEventListener('click', () => this.showSkillTableSelector());
    });
  },

  renderSkillRoller() {
    const container = document.getElementById('skill-roller');
    if (!container || !this.xpData || !this.xpData.skills) return;

    container.innerHTML = `
      <hr class="hr-dark" style="margin: 40px 0;">
      <h2 class="mb-15">Random Skill Generator</h2>
      <div style="display:flex;gap:0.5rem;">
        <button id="open-skill-roller" class="btn" style="flex:7;">Anyone except an Exotic Beast</button>
        <button id="open-skill-roller-exotic" class="btn" style="flex:3;">Exotic Beast</button>
      </div>
      <div id="skill-roller-results"></div>
    `;

    document.getElementById('open-skill-roller').addEventListener('click', () => {
      this.showSkillRollerDialog(false);
    });
    document.getElementById('open-skill-roller-exotic').addEventListener('click', () => {
      this.showSkillRollerDialog(true);
    });
  },

  showSkillRollerDialog(exoticBeastMode = false) {
    const skills = this.xpData.skills;

    const formatGangName = (gang) =>
      gang.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    const makeOptions = (entries, showGang = false) =>
      entries.map(([key, data]) => {
        let label = key;
        if (showGang || data.class) {
          const parts = [];
          if (showGang) parts.push(formatGangName(data.gang));
          if (data.class) parts.push(capitalize(data.class));
          label = `${key} (${parts.join(', ')})`;
        }
        return `<option value="${key}">${label}</option>`;
      }).join('');

    const buildOptions = () => {
      const all = Object.entries(skills);
      const filtered = exoticBeastMode
        ? all.filter(([, d]) => this._hasExoticBeastSkills(d))
        : all;
      const unaffiliated = filtered.filter(([, d]) => d.gang === 'unaffiliated');
      const affiliated   = filtered.filter(([, d]) => d.gang !== 'unaffiliated');
      let html = unaffiliated.length
        ? `<optgroup label="Unaffiliated Skills">${makeOptions(unaffiliated)}</optgroup>`
        : '';
      html += affiliated.length
        ? `<optgroup label="Affiliated Skills">${makeOptions(affiliated, true)}</optgroup>`
        : '';
      return html;
    };

    const overlay = document.createElement('div');
    overlay.className = 'suit-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'suit-dialog';
    dialog.innerHTML = `
      <h2>${exoticBeastMode ? 'Roll a Random Exotic Beast Skill' : 'Roll a Random Skill'}</h2>
      <div style="text-align:left; margin-bottom:1.5rem;">
        <label style="display:block;margin-bottom:0.35rem;color:#333;font-weight:bold;">Select Skill Table:</label>
        <select class="select-input skill-dialog-select">
          ${buildOptions()}
        </select>
      </div>
      <div class="number-input-buttons">
        <button class="confirm-button">Roll</button>
        <button class="cancel-button">Cancel</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const select = dialog.querySelector('.skill-dialog-select');
    const confirmButton = dialog.querySelector('.confirm-button');
    const cancelButton = dialog.querySelector('.cancel-button');

    const confirm = () => {
      document.body.removeChild(overlay);
      this.rollSkillFromSelector(select.value, exoticBeastMode);
    };

    confirmButton.addEventListener('click', confirm);
    cancelButton.addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
    select.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });
  },

  rollSkillFromSelector(selectedKey, isExoticBeast = false) {
    const tableData = this.xpData && this.xpData.skills && this.xpData.skills[selectedKey];
    if (!tableData) return;

    const isD66 = tableData.sides === 'd66';
    let roll, skillName, extraInfo = '', rollLabel = 'D6';

    if (isExoticBeast) {
      let entry;
      do {
        roll = Dice.d(6);
        entry = tableData[roll];
      } while (!(entry && typeof entry === 'object' && entry.exotic_beast === true));
      skillName = entry.name;
    } else if (isD66) {
      rollLabel = 'D66';
      roll = Dice.d66();
      const found = this._findEntryByValues(tableData.results || [], roll);
      skillName = found ? found.name : 'Unknown';
    } else {
      roll = Dice.d(6);
      const entry = tableData[roll];
      skillName = typeof entry === 'string' ? entry : (entry && entry.name) || 'Unknown';
      if (entry && typeof entry === 'object' && entry.cost !== undefined) {
        extraInfo = ` — ${entry.cost} Credits`;
      }
    }

    const resultsContainer = document.getElementById('skill-roller-results');
    if (!resultsContainer) return;

    const isWyrd = tableData.class === 'Psychic';
    const isLegendaryName = tableData.class === 'Legendary Name' || tableData.class === 'Crew Legendary Name';
    const conditionalSpecialHtml = tableData.conditional_special
      ? isWyrd
        ? `<p class="table-footnote">If all your Wyrd powers (including gang-specific Wyrd & Psychoteric Whispers) belong to this Discipline, also gain: <b>${tableData.conditional_special}</b>.</p>`
        : `<p class="table-footnote">${tableData.conditional_special}</p>`
      : '';

    const footnote = (isD66 || extraInfo)
      ? ''
      : isLegendaryName
        ? `<p class="table-footnote">If you have this legendary name already - Select one from this category instead.</p>`
        : `<p class="table-footnote">If you have this skill already - Select one instead.</p>`;

    const resultLabel = isLegendaryName
      ? `<b>${selectedKey}</b>: ${rollLabel} ${roll}: ${skillName}`
      : `<b>${selectedKey}</b>: ${rollLabel} ${roll}: ${skillName}${extraInfo}`;

    const div = document.createElement('div');
    div.className = 'result-box result-box-green mt-20';
    div.innerHTML = `<div class="result-heading result-name">${resultLabel}</div>${footnote}${conditionalSpecialHtml}`;
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(div);
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('xpTablesLastRun', [`${rollLabel}: ${roll}`]);
    }
  },

  displaySkillTables() {
    const container = document.getElementById("skill-tables-list");
    if (!container) return;

    const skillTables = XPTablesEngine.getSkillTables();
    if (skillTables.length === 0) return;

    container.innerHTML = `
      <h2 class="mb-15 mt-30">Skill Tables</h2>
      <p class="mb-15">Roll on these tables when an advancement requires a specific skill selection:</p>
      <div class="skill-buttons-grid">${this._skillButtonsHTML(skillTables)}</div>
    `;
    this._bindSkillTableButtons(container);
  },

  showSkillTableSelector() {
    const container = document.getElementById("xp-tables-results");
    if (!container) return;

    container.innerHTML = `
      <div class="mt-20">
        <h2 class="mb-15">Select a Skill Table to Roll:</h2>
        <div class="skill-buttons-grid">${this._skillButtonsHTML()}</div>
      </div>
    `;
    this._bindSkillTableButtons(container);
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  _hasExoticBeastSkills(tableData) {
    return Object.entries(tableData)
      .some(([k, v]) => !isNaN(k) && v && typeof v === 'object' && v.exotic_beast === true);
  },

  // Finds the first entry in a results array whose values range includes the given roll.
  _findEntryByValues(results, roll) {
    for (const entry of results) {
      let values = entry.values;
      if (!Array.isArray(values)) values = [values];
      if (XPTablesEngine.isInRange(roll, values)) return entry;
    }
    return null;
  },

  _skillButtonsHTML(skillTables = XPTablesEngine.getSkillTables()) {
    return skillTables
      .map(t => `<button class="btn-skill" data-table-id="${t.id}">${t.name}</button>`)
      .join('');
  },

  _bindSkillTableButtons(container) {
    container.querySelectorAll('[data-table-id]').forEach(btn => {
      btn.addEventListener('click', () => this.rollSkillTable(btn.dataset.tableId));
    });
  },

  rollAdvancement() {
    const advancementResult = XPTablesEngine.rollAdvancement();
    if (typeof TimerUtil !== 'undefined') {
      const rolls = advancementResult.rolls
        ? [`2D6: ${advancementResult.rolls.join(' + ')} = ${advancementResult.total}`]
        : [];
      TimerUtil.markRun('xpTablesLastRun', rolls);
    }
    this.displayAdvancementResult(advancementResult);
  },

  rollSkillTable(skillTableName) {
    const skillResult = XPTablesEngine.rollSkillTable(skillTableName);
    this.displaySkillResult(skillResult);
  },

  displayAdvancementResult(advancementResult) {
    const resultsContainer = document.getElementById("xp-tables-results");
    if (!resultsContainer) return;

    // Clear previous results
    resultsContainer.innerHTML = "";

    if (advancementResult.error) {
      resultsContainer.innerHTML = `<div class="error-box">${advancementResult.error}</div>`;
      return;
    }

    // Create main result container
    const mainContainer = document.createElement("div");
    mainContainer.classList.add('mt-20');

    // Display main result
    const resultBox = this.createAdvancementResultBox(advancementResult.result, advancementResult.rolls, advancementResult.total);
    mainContainer.appendChild(resultBox);

    resultsContainer.appendChild(mainContainer);

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  displaySkillResult(skillResult) {
    const resultsContainer = document.getElementById("xp-tables-results");
    if (!resultsContainer) return;

    // Clear previous results
    resultsContainer.innerHTML = "";

    if (skillResult.error) {
      resultsContainer.innerHTML = `<div class="error-box">${skillResult.error}</div>`;
      return;
    }

    // Create main result container
    const mainContainer = document.createElement("div");
    mainContainer.classList.add('mt-20');

    // Display title
    const title = document.createElement("h2");
    const skillName = skillResult.tableName.replace('skill_', '').replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    title.textContent = `${skillName} Skill:`;
    title.classList.add('mb-15');
    mainContainer.appendChild(title);

    // Display skill result
    const resultBox = this.createSkillResultBox(skillResult.result, skillResult.rolls, skillResult.total);
    mainContainer.appendChild(resultBox);

    const note = document.createElement("p");
    note.className = "table-footnote";
    note.textContent = "* If you already have the random skill, select one from that skillset instead.";
    mainContainer.appendChild(note);

    resultsContainer.appendChild(mainContainer);

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  renderSkillsReferenceTable() {
    const container = document.getElementById('skills-reference-table');
    if (!container || !this.xpData || !this.xpData.skills) return;

    const formatGangName = (gang) =>
      gang === 'unaffiliated'
        ? 'Unaffiliated'
        : gang.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    const sections = Object.entries(this.xpData.skills).map(([skillsetName, data]) => {
      const gangLabel = formatGangName(data.gang);
      const parts = [gangLabel];
      if (data.class) parts.push(capitalize(data.class));
      const metaLabel = parts.join(', ');

      const isD66 = data.sides === 'd66';
      let headers, rows;
      if (isD66) {
        const hasCost = (data.results || []).some(e => e.cost !== undefined);
        const costHeader = hasCost ? '<th>Cost</th>' : '';
        headers = `<th>D66</th><th>Result</th>${costHeader}`;
        rows = (data.results || []).map(e => {
          let values = e.values;
          if (!Array.isArray(values)) values = [values];
          const valStr = values.join(', ');
          const costCell = hasCost ? `<td>${e.cost !== undefined ? `${e.cost} Credits` : '—'}</td>` : '';
          return `<tr><td>${valStr}</td><td>${e.name}</td>${costCell}</tr>`;
        }).join('');
      } else {
        const hasExotic = this._hasExoticBeastSkills(data);
        const hasCost = [1,2,3,4,5,6].some(n => data[n] && typeof data[n] === 'object' && data[n].cost !== undefined);
        const exoticHeader = hasExotic ? '<th>Exotic Beast</th>' : '';
        const costHeader = hasCost ? '<th>Cost</th>' : '';
        headers = `<th>Roll</th><th>Skill</th>${exoticHeader}${costHeader}`;
        rows = [1, 2, 3, 4, 5, 6].map(n => {
          const entry = data[n];
          const name = typeof entry === 'string' ? entry : (entry && entry.name) || '—';
          const exoticCell = hasExotic
            ? `<td class="text-center">${(entry && typeof entry === 'object' && entry.exotic_beast) ? '✓' : ''}</td>`
            : '';
          const costCell = hasCost
            ? `<td>${(entry && typeof entry === 'object' && entry.cost !== undefined) ? `${entry.cost} Credits` : '—'}</td>`
            : '';
          return `<tr><td>${n}</td><td>${name}</td>${exoticCell}${costCell}</tr>`;
        }).join('');
      }

      const isWyrd = data.class === 'Psychic';
      const conditionalSpecialHtml = data.conditional_special
        ? isWyrd
          ? `<p class="table-footnote mt-10">If all your Wyrd powers (including gang-specific Wyrd & Psychoteric Whispers) belong to this Discipline, also gain: <b>${data.conditional_special}</b>.</p>`
          : `<p class="table-footnote mt-10">${data.conditional_special}</p>`
        : '';

      return `
        <details class="reference-tables-collapsible">
          <summary>${skillsetName} <span class="text-muted text-small">(${metaLabel})</span></summary>
          <table class="advancement-table mt-10">
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${conditionalSpecialHtml}
        </details>`;
    }).join('');

    container.innerHTML = sections;
  },

  createAdvancementResultBox(result, rolls, total) {
    const ratingHtml = result.ratingIncrease != null
      ? `<div class="result-effect">Rating: +${result.ratingIncrease}</div>`
      : '';
    const div = document.createElement('div');
    div.className = 'result-box result-box-blue';
    div.innerHTML = `
      <div class="result-heading result-name">${result.advancement}</div>
      ${ratingHtml}
    `;
    return div;
  },

  displayRandomAdvancementsTable() {
    const container = document.getElementById("random-advancement-table");
    if (!container) return;

    const randomTable = XPTablesEngine.getTable('advancements_random');
    if (!randomTable || !randomTable.results) return;

    const rows = Object.values(randomTable.results).map(data => {
      const rating = data.ratingIncrease != null ? `+${data.ratingIncrease}` : 'n/a';
      return `<tr>
        <td>${data.values.join(', ')}</td>
        <td>${data.advancement}</td>
        <td>${rating}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <table class="advancement-table">
        <thead><tr><th>2D6 Roll</th><th>Advancement</th><th>Rating Increase</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  },

  createSkillResultBox(result, rolls, total) {
    const div = document.createElement('div');
    div.className = 'result-box result-box-green';
    div.innerHTML = `
      <div class="result-heading result-name"><b>${result.name}</b></div>
    `;
    return div;
  }
};
