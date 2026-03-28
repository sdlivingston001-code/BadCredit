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
      <button id="open-skill-roller" class="btn">Roll a Random Skill</button>
      <div id="skill-roller-results"></div>
    `;

    document.getElementById('open-skill-roller').addEventListener('click', () => {
      this.showSkillRollerDialog();
    });
  },

  showSkillRollerDialog() {
    const skills = this.xpData.skills;

    const formatGangName = (gang) =>
      gang.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const makeOptions = (entries, showGang = false) =>
      entries.map(([key, data]) => {
        const label = showGang ? `${key} (${formatGangName(data.gang)})` : key;
        return `<option value="${key}">${label}</option>`;
      }).join('');

    const buildOptions = (exoticOnly) => {
      const all = Object.entries(skills);
      const filtered = exoticOnly
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
      <h2>Roll a Random Skill</h2>
      <div style="text-align:left; margin-bottom:1rem;">
        <label style="display:block;margin-bottom:0.35rem;color:#333;font-weight:bold;">Select Skill Table:</label>
        <select class="select-input skill-dialog-select">
          ${buildOptions(false)}
        </select>
      </div>
      <div style="text-align:left; margin-bottom:1.5rem;">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
          <input type="checkbox" class="exotic-beast-checkbox">
          Exotic Beast
        </label>
      </div>
      <div class="number-input-buttons">
        <button class="confirm-button">Roll</button>
        <button class="cancel-button">Cancel</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const select = dialog.querySelector('.skill-dialog-select');
    const checkbox = dialog.querySelector('.exotic-beast-checkbox');
    const confirmButton = dialog.querySelector('.confirm-button');
    const cancelButton = dialog.querySelector('.cancel-button');

    checkbox.addEventListener('change', () => {
      select.innerHTML = buildOptions(checkbox.checked);
    });

    const confirm = () => {
      document.body.removeChild(overlay);
      this.rollSkillFromSelector(select.value, checkbox.checked);
    };

    confirmButton.addEventListener('click', confirm);
    cancelButton.addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
    select.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });
  },

  rollSkillFromSelector(selectedKey, isExoticBeast = false) {
    const tableData = this.xpData && this.xpData.skills && this.xpData.skills[selectedKey];
    if (!tableData) return;

    let roll, skillName;
    if (isExoticBeast) {
      let entry;
      do {
        roll = Dice.d(6);
        entry = tableData[roll];
      } while (!(entry && typeof entry === 'object' && entry.exotic_beast === true));
      skillName = entry.name;
    } else {
      roll = Dice.d(6);
      const entry = tableData[roll];
      skillName = typeof entry === 'string' ? entry : (entry && entry.name) || 'Unknown';
    }

    const resultsContainer = document.getElementById('skill-roller-results');
    if (!resultsContainer) return;

    const div = document.createElement('div');
    div.className = 'result-box result-box-green mt-20';
    div.innerHTML = `<div class="result-heading result-name"><b>${selectedKey}</b>: ${roll}: ${skillName}</div><p class="table-footnote">If you have this skill already - Select one instead.</p>`;
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(div);
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('xpTablesLastRun', [`D6: ${roll}`]);
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
    note.textContent = "* If you already have the random skill; select one from that skillset instead.";
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

    const sections = Object.entries(this.xpData.skills).map(([skillsetName, data]) => {
      const gang = formatGangName(data.gang);
      const hasExotic = this._hasExoticBeastSkills(data);
      const rows = [1, 2, 3, 4, 5, 6].map(n => {
        const entry = data[n];
        const name = typeof entry === 'string' ? entry : (entry && entry.name) || '—';
        const exoticCell = hasExotic
          ? `<td class="text-center">${(entry && typeof entry === 'object' && entry.exotic_beast) ? '✓' : ''}</td>`
          : '';
        return `<tr><td>${n}</td><td>${name}</td>${exoticCell}</tr>`;
      }).join('');

      const exoticHeader = hasExotic ? '<th>Exotic Beast</th>' : '';

      return `
        <details class="reference-tables-collapsible">
          <summary>${skillsetName} <span class="text-muted text-small">(${gang})</span></summary>
          <table class="advancement-table mt-10">
            <thead><tr><th>Roll</th><th>Skill</th>${exoticHeader}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
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
