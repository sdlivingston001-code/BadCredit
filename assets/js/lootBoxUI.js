// lootBoxUI.js

const LootBoxUI = {
  lootData: null,

  async init(jsonPath) {
    try {
      const response = await fetch(`${jsonPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load loot box data: ${response.status}`);
      }

      this.lootData = await response.json();
      LootBoxEngine.loadLootData(this.lootData);

      this.bindEvents();
      this.initTimer();

      // Expose test functions to window for console testing
      window.testLootBox = (roll, autoResolve = false) => {
        const result = LootBoxEngine.testRoll(roll, autoResolve);
        if (result) {
          this.displayLootBoxResult(result);
          console.log('Test loot box result for roll ' + roll + ':', result);
        }
      };

      window.testNestedTable = (tableName, roll = null) => {
        const result = LootBoxEngine.testNestedTable(tableName, roll);
        if (result && !result.error) {
          const container = document.getElementById('loot-box-results');
          if (container) {
            container.innerHTML = `<div class="mt-20"><h3 class="mb-15">Testing: ${tableName}</h3></div>`;
            const mainContainer = container.querySelector('div');
            if (result.rerollHistory && result.rerollHistory.length > 0) {
              const rerollDiv = document.createElement('div');
              rerollDiv.className = 'info-box reroll-history-box';
              rerollDiv.innerHTML = `🔄 <b>Rerolled:</b> ${result.rerollHistory.map(r => `${r.name} (${r.roll})`).join(', ')}`;
              mainContainer.appendChild(rerollDiv);
            }
            mainContainer.appendChild(this.createResultBox(result.result, result.roll, result.tableName));
            if (result.randomEffect) this.displayNestedEffect(result.randomEffect, mainContainer);
          }
          console.log('Test nested table result:', result);
        } else if (result && result.error) {
          console.error(result.error);
        }
      };

      console.log('%c🎁 Loot Box Testing Enabled', 'color: #FFD700; font-weight: bold; font-size: 14px;');
      console.log('Use: testLootBox(roll, autoResolve) - e.g., testLootBox(4) or testLootBox(4, true)');
      console.log('Use: testNestedTable(tableName, roll) - e.g., testNestedTable("d66drugs", 11) or testNestedTable("d3skull")');
    } catch (err) {
      console.error(err);
      const container = document.getElementById("loot-box-container");
      if (container) {
        container.innerHTML = '<div class="error-box">Error loading loot box data.</div>';
      }
    }
  },

  bindEvents() {
    const smashBtn = document.getElementById("resolve-loot-box-smash");
    if (smashBtn) {
      smashBtn.addEventListener("click", () => this.openLootBoxSmash());
    }
    const bypassBtn = document.getElementById("resolve-loot-box-bypass");
    if (bypassBtn) {
      bypassBtn.addEventListener("click", () => this.openLootBox());
    }
  },

  initTimer() {
    // Use existing timer container placed after the buttons in HTML
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.init('loot-box-timer', 'lootBoxLastRun');
      
      // Setup page cleanup to reset timer on navigation
      TimerUtil.setupPageCleanup();
    }
  },

  createResultBox(result, roll, tableName = null, rawRoll = null) {
    const colour = result.colour || "grey";
    const table = tableName ? this.lootData[tableName] : this.lootData.loot_box_roll;
    const sides = table && table.sides;
    const diceType = sides === "d66" ? "D66" : `D${typeof sides === 'number' ? sides : parseInt(sides)}`;
    const rollDisplay = (rawRoll !== null && rawRoll !== undefined && rawRoll !== roll)
      ? `${rawRoll} &rarr; ${roll}`
      : roll;

    const div = document.createElement("div");
    div.className = `result-box result-box-${colour}`;
    div.innerHTML = `
      <div class="result-heading result-name"><b>${result.name}</b></div>
      ${result.fixedeffect ? `<div class="result-effect">${result.fixedeffect}</div>` : ''}
    `;
    return div;
  },

  createIncomeBox(incomeResult) {
    const incomeDiv = document.createElement("div");
    incomeDiv.className = "info-box income-box";

    const rollInfo = incomeResult.sides 
      ? `D${incomeResult.sides} Roll: <b>${incomeResult.roll}</b>`
      : '';
    
    const calculation = incomeResult.multiplier > 1 
      ? ` × ${incomeResult.multiplier} = <b>${incomeResult.amount} credits</b>`
      : ` = <b>${incomeResult.amount} credits</b>`;

    incomeDiv.innerHTML = `💰 <b>Income:</b> ${rollInfo}${calculation}`;
    
    return incomeDiv;
  },

  displayNestedEffect(randomEffect, parentDiv) {
    if (!randomEffect) return;

    if (randomEffect.type === 'reroll') {
      const div = document.createElement("div");
      div.className = "info-box reroll-box";
      div.innerHTML = "🔄 <b>Reroll:</b> This result requires a reroll.";
      parentDiv.appendChild(div);
      return;
    }

    if (randomEffect.type === 'pending_roll') {
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "nested-content mt-15";
      buttonContainer.innerHTML = `
        <div class="info-box mb-10">⚡ <b>Additional Roll Required... Click to proceed.</b></div>
        <button class="btn">Roll the dice</button>
      `;
      buttonContainer.querySelector('button').addEventListener('click', () => {
        this.rollNestedTable(randomEffect.tableName, buttonContainer);
      });
      parentDiv.appendChild(buttonContainer);
    }

    if (randomEffect.type === 'nested_table' && randomEffect.result) {
      const nestedContainer = document.createElement("div");
      nestedContainer.className = "nested-content";
      nestedContainer.innerHTML = `<div class="nested-title"><b>➡️ Additional Result:</b></div>`;
      nestedContainer.appendChild(this.createResultBox(randomEffect.result, randomEffect.roll, randomEffect.tableName));
      if (randomEffect.nestedEffect) {
        this.displayNestedEffect(randomEffect.nestedEffect, nestedContainer);
      }
      parentDiv.appendChild(nestedContainer);
    }
  },

  rollNestedTable(tableName, containerDiv) {
    const result = LootBoxEngine.rollNestedTable(tableName);

    if (result.error) {
      containerDiv.innerHTML = `<div class="error-box">${result.error}</div>`;
      return;
    }

    if (typeof TimerUtil !== 'undefined') {
      const table = this.lootData && this.lootData[result.tableName];
      const sides = table && table.sides;
      const diceType = sides === 'd66' ? 'D66' : `D${typeof sides === 'number' ? sides : parseInt(sides)}`;
      const nestedRolls = [];
      if (result.rerollHistory) {
        result.rerollHistory.forEach(r => nestedRolls.push(`${diceType} (rerolled): ${r.roll}`));
      }
      nestedRolls.push(`${diceType}: ${result.roll}`);
      try {
        const stored = localStorage.getItem('lootBoxLastRun_rolls');
        const existingRolls = stored ? JSON.parse(stored) : [];
        TimerUtil.recordRolls('lootBoxLastRun', [...existingRolls, ...nestedRolls]);
      } catch (e) {
        TimerUtil.recordRolls('lootBoxLastRun', nestedRolls);
      }
    }

    containerDiv.innerHTML = "";

    if (result.rerollHistory && result.rerollHistory.length > 0) {
      const rerollDiv = document.createElement("div");
      rerollDiv.className = "info-box reroll-history-box";
      rerollDiv.innerHTML = `🔄 <b>Rerolled:</b> ${result.rerollHistory.map(r => `${r.name} (${r.roll})`).join(", ")}`;
      containerDiv.appendChild(rerollDiv);
    }

    const titleDiv = document.createElement("div");
    titleDiv.className = "nested-title";
    titleDiv.innerHTML = `<b>➡️ Additional Result:</b>`;
    containerDiv.appendChild(titleDiv);
    containerDiv.appendChild(this.createResultBox(result.result, result.roll, result.tableName));

    if (result.randomEffect) {
      this.displayNestedEffect(result.randomEffect, containerDiv);
    }
  },

  openLootBoxSmash() {
    const lootResult = LootBoxEngine.smashOpenLootBox();
    if (typeof TimerUtil !== 'undefined') {
      const rolls = [];
      if (lootResult.rawRoll !== undefined) rolls.push(`D66: ${lootResult.roll} (smashed from ${lootResult.rawRoll})`);
      else if (lootResult.roll !== undefined) rolls.push(`D66: ${lootResult.roll}`);
      if (lootResult.incomeResult && lootResult.incomeResult.roll !== undefined) rolls.push(`Income: ${lootResult.incomeResult.roll}`);
      TimerUtil.markRun('lootBoxLastRun', rolls);
      TimerUtil.showTimer('loot-box-timer');
    }
    this.displayLootBoxResult(lootResult);
  },

  openLootBox() {
    const lootResult = LootBoxEngine.openLootBox();
    if (typeof TimerUtil !== 'undefined') {
      const rolls = [];
      if (lootResult.roll !== undefined) rolls.push(`D66: ${lootResult.roll}`);
      if (lootResult.incomeResult && lootResult.incomeResult.roll !== undefined) rolls.push(`Income: ${lootResult.incomeResult.roll}`);
      TimerUtil.markRun('lootBoxLastRun', rolls);
      TimerUtil.showTimer('loot-box-timer');
    }
    this.displayLootBoxResult(lootResult);
  },

  displayLootBoxResult(lootResult) {
    const resultsContainer = document.getElementById("loot-box-results");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";

    if (lootResult.error) {
      resultsContainer.innerHTML = `<div class="error-box">${lootResult.error}</div>`;
      return;
    }

    const mainContainer = document.createElement("div");
    mainContainer.className = "mt-20";
    mainContainer.innerHTML = '<h3 class="mb-15">Loot Box Contents:</h3>';
    mainContainer.appendChild(this.createResultBox(lootResult.result, lootResult.roll, null, lootResult.rawRoll));

    if (lootResult.incomeResult) {
      mainContainer.appendChild(this.createIncomeBox(lootResult.incomeResult));
    }

    if (lootResult.randomEffect) {
      this.displayNestedEffect(lootResult.randomEffect, mainContainer);
    }

    resultsContainer.appendChild(mainContainer);
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};
