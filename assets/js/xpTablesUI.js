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
      this.displaySkillTables();
      this.displayRandomAdvancementsTable();

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
    // Create timer container below the button
    const button = document.getElementById("roll-advancement");
    if (button && typeof TimerUtil !== 'undefined') {
      const timerContainer = document.createElement("div");
      timerContainer.id = "xp-tables-timer";
      timerContainer.className = "mt-15";
      button.parentNode.insertBefore(timerContainer, button.nextSibling);
      TimerUtil.init('xp-tables-timer', 'xpTablesLastRun');
      
      // Setup page cleanup to reset timer on navigation
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
      <h3 class="mb-15">User Choice Advancements</h3>
      <p class="mb-15"><em>Leaders, Champions, Brutes, Prospects, Juves, Specialists.</em></p>
      <table class="advancement-table">
        <thead><tr><th>Cost</th><th>Advancement</th><th>Rating Increase</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="table-footnote">* If you already have the random skill; select one from that skillset instead.</p>
    `;
    container.querySelectorAll('.btn-small').forEach(btn => {
      btn.addEventListener('click', () => this.showSkillTableSelector());
    });
  },

  displaySkillTables() {
    const container = document.getElementById("skill-tables-list");
    if (!container) return;

    const skillTables = XPTablesEngine.getSkillTables();
    if (skillTables.length === 0) return;

    const buttons = skillTables.map(t => `<button class="btn-skill" data-table-id="${t.id}">${t.name}</button>`).join('');

    container.innerHTML = `
      <h3 class="mb-15 mt-30">Skill Tables</h3>
      <p class="mb-15">Roll on these tables when an advancement requires a specific skill selection:</p>
      <div class="skill-buttons-grid">${buttons}</div>
    `;
    container.querySelectorAll('[data-table-id]').forEach(btn => {
      btn.addEventListener('click', () => this.rollSkillTable(btn.dataset.tableId));
    });
  },

  showSkillTableSelector() {
    const container = document.getElementById("xp-tables-results");
    if (!container) return;

    const buttons = XPTablesEngine.getSkillTables()
      .map(t => `<button class="btn-skill" data-table-id="${t.id}">${t.name}</button>`)
      .join('');

    container.innerHTML = `
      <div class="mt-20">
        <h3 class="mb-15">Select a Skill Table to Roll:</h3>
        <div class="skill-buttons-grid">${buttons}</div>
      </div>
    `;
    container.querySelectorAll('[data-table-id]').forEach(btn => {
      btn.addEventListener('click', () => this.rollSkillTable(btn.dataset.tableId));
    });
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  rollAdvancement() {
    const advancementResult = XPTablesEngine.rollAdvancement();
    if (typeof TimerUtil !== 'undefined') {
      const rolls = advancementResult.rolls
        ? [`2D6: ${advancementResult.rolls.join(' + ')} = ${advancementResult.total}`]
        : [];
      TimerUtil.markRun('xpTablesLastRun', rolls);
      TimerUtil.showTimer('xp-tables-timer');
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

    // Display title
    const title = document.createElement("h3");
    title.textContent = "Advancement Roll:";
    title.classList.add('mb-15');
    mainContainer.appendChild(title);

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
    const title = document.createElement("h3");
    const skillName = skillResult.tableName.replace('skill_', '').replace('_', ' ')
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

  createAdvancementResultBox(result, rolls, total) {
    const diceHtml = rolls ? `(${rolls.join(' + ')}) = ` : '';
    const ratingHtml = result.ratingIncrease != null
      ? `<div class="result-effect"><b>Rating Increase:</b> +${result.ratingIncrease}</div>`
      : '';
    const div = document.createElement('div');
    div.className = 'result-box result-box-blue';
    div.innerHTML = `
      <div class="result-heading result-name"><b>${result.advancement}</b></div>
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
      <h3 class="mb-15 mt-30">Random Advancement Table</h3>
      <table class="advancement-table">
        <thead><tr><th>2D6 Roll</th><th>Advancement</th><th>Rating Increase</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  },

  createSkillResultBox(result, rolls, total) {
    const diceHtml = rolls ? `(${rolls.join(' + ')}) = ` : '';
    const div = document.createElement('div');
    div.className = 'result-box result-box-green';
    div.innerHTML = `
      <div class="result-heading result-name"><b>${result.name}</b></div>
    `;
    return div;
  }
};
