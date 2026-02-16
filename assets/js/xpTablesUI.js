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

    const advancementsData = this.xpData.advancements_userchoice;
    
    const title = document.createElement("h3");
    title.textContent = "User Choice Advancements";
    title.className = "mb-15";
    container.appendChild(title);

    const table = document.createElement("table");
    table.className = "advancement-table";
    
    // Create header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ['Cost', 'Advancement', 'Rating Increase'].forEach(header => {
      const th = document.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement("tbody");
    Object.entries(advancementsData).forEach(([key, data]) => {
      const row = document.createElement("tr");
      
      const costCell = document.createElement("td");
      costCell.textContent = data.cost;
      row.appendChild(costCell);
      
      const advCell = document.createElement("td");
      advCell.innerHTML = data.advancement;
      row.appendChild(advCell);
      
      const ratingCell = document.createElement("td");
      ratingCell.textContent = data.ratingIncrease !== null ? `+${data.ratingIncrease}` : 'n/a';
      row.appendChild(ratingCell);
      
      tbody.appendChild(row);

      // Add skill roll button if this advancement has a sides property
      if (data.sides) {
        const buttonRow = document.createElement("tr");
        buttonRow.className = "skill-button-row";
        const buttonCell = document.createElement("td");
        buttonCell.colSpan = 3;
        buttonCell.className = "text-center";
        
        const skillButton = document.createElement("button");
        skillButton.className = "btn-small";
        skillButton.textContent = "Roll for Skill";
        skillButton.onclick = () => this.showSkillTableSelector(key);
        buttonCell.appendChild(skillButton);
        
        buttonRow.appendChild(buttonCell);
        tbody.appendChild(buttonRow);
      }
    });
    table.appendChild(tbody);
    
    container.appendChild(table);
  },

  displaySkillTables() {
    const container = document.getElementById("skill-tables-list");
    if (!container) return;

    const skillTables = XPTablesEngine.getSkillTables();
    if (skillTables.length === 0) return;

    const title = document.createElement("h3");
    title.textContent = "Skill Tables";
    title.className = "mb-15 mt-30";
    container.appendChild(title);

    const description = document.createElement("p");
    description.textContent = "Roll on these tables when an advancement requires a specific skill selection:";
    description.className = "mb-15";
    container.appendChild(description);

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "skill-buttons-grid";

    skillTables.forEach(table => {
      const button = document.createElement("button");
      button.className = "btn-skill";
      button.textContent = table.name;
      button.onclick = () => this.rollSkillTable(table.id);
      buttonContainer.appendChild(button);
    });

    container.appendChild(buttonContainer);
  },

  showSkillTableSelector(advancementKey) {
    const resultsContainer = document.getElementById("xp-tables-results");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";

    const mainContainer = document.createElement("div");
    mainContainer.classList.add('mt-20');

    const title = document.createElement("h3");
    title.textContent = "Select a Skill Table to Roll:";
    title.classList.add('mb-15');
    mainContainer.appendChild(title);

    const skillTables = XPTablesEngine.getSkillTables();
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "skill-buttons-grid";

    skillTables.forEach(table => {
      const button = document.createElement("button");
      button.className = "btn-skill";
      button.textContent = table.name;
      button.onclick = () => this.rollSkillTable(table.id);
      buttonContainer.appendChild(button);
    });

    mainContainer.appendChild(buttonContainer);
    resultsContainer.appendChild(mainContainer);

    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  rollAdvancement() {
    // Mark the run time and show timer
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('xpTablesLastRun');
      TimerUtil.showTimer('xp-tables-timer');
    }

    // Get advancement result
    const advancementResult = XPTablesEngine.rollAdvancement();
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
    const resultBox = this.createAdvancementResultBox(advancementResult.result, advancementResult.roll);
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
    const resultBox = this.createSkillResultBox(skillResult.result, skillResult.roll);
    mainContainer.appendChild(resultBox);

    resultsContainer.appendChild(mainContainer);

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  createAdvancementResultBox(result, roll) {
    const resultDiv = document.createElement("div");
    resultDiv.className = "result-box result-box-blue";

    // Display roll info
    const rollText = document.createElement("div");
    rollText.className = "result-heading result-roll";
    rollText.innerHTML = `<strong>2D6 Roll:</strong> ${roll}`;
    resultDiv.appendChild(rollText);

    // Display advancement text
    const advText = document.createElement("div");
    advText.className = "result-heading result-name";
    advText.innerHTML = `<strong>${result.advancement}</strong>`;
    resultDiv.appendChild(advText);

    // Display rating increase if present
    if (result.ratingIncrease !== null && result.ratingIncrease !== undefined) {
      const ratingDiv = document.createElement("div");
      ratingDiv.className = "result-effect";
      ratingDiv.innerHTML = `<strong>Rating Increase:</strong> +${result.ratingIncrease}`;
      resultDiv.appendChild(ratingDiv);
    }

    return resultDiv;
  },

  createSkillResultBox(result, roll) {
    const resultDiv = document.createElement("div");
    resultDiv.className = "result-box result-box-green";

    // Display roll info
    const rollText = document.createElement("div");
    rollText.className = "result-heading result-roll";
    rollText.innerHTML = `<strong>D6 Roll:</strong> ${roll}`;
    resultDiv.appendChild(rollText);

    // Display skill name
    const nameText = document.createElement("div");
    nameText.className = "result-heading result-name";
    nameText.innerHTML = `<strong>${result.name}</strong>`;
    resultDiv.appendChild(nameText);

    return resultDiv;
  }
};
