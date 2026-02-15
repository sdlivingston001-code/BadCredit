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
    } catch (err) {
      console.error(err);
      const container = document.getElementById("loot-box-container");
      if (container) {
        container.innerHTML = '<div class="error-box">Error loading loot box data.</div>';
      }
    }
  },

  bindEvents() {
    const button = document.getElementById("resolve-loot-box");
    if (button) {
      button.addEventListener("click", () => this.openLootBox());
    }
  },

  initTimer() {
    // Create timer container below the button
    const button = document.getElementById("resolve-loot-box");
    if (button && typeof TimerUtil !== 'undefined') {
      const timerContainer = document.createElement("div");
      timerContainer.id = "loot-box-timer";
      timerContainer.className = "mt-15";
      button.parentNode.insertBefore(timerContainer, button.nextSibling);
      TimerUtil.init('loot-box-timer', 'lootBoxLastRun');
      
      // Setup page cleanup to reset timer on navigation
      TimerUtil.setupPageCleanup();
    }
  },

  createResultBox(result, roll, tableName = null) {
    const colour = result.colour || "grey";
    const resultDiv = document.createElement("div");
    resultDiv.className = `result-box result-box-${colour}`;

    // Display roll info
    if (roll !== null && roll !== undefined) {
      const rollText = document.createElement("div");
      rollText.className = "result-heading result-roll";
      const table = tableName ? this.lootData[tableName] : this.lootData.loot_box_roll;
      const diceType = table && table.sides === 66 ? "D66" : table && table.sides === 3 ? "D3" : "D6";
      rollText.innerHTML = `<strong>${diceType} Roll:</strong> ${roll}`;
      resultDiv.appendChild(rollText);
    }

    // Display result name
    const nameText = document.createElement("div");
    nameText.className = "result-heading result-name";
    nameText.innerHTML = `<strong>${result.name}</strong>`;
    resultDiv.appendChild(nameText);

    // Display fixed effect
    if (result.fixedeffect) {
      const effectDiv = document.createElement("div");
      effectDiv.className = "result-effect";
      effectDiv.innerHTML = result.fixedeffect;
      resultDiv.appendChild(effectDiv);
    }

    return resultDiv;
  },

  createIncomeBox(incomeResult) {
    const incomeDiv = document.createElement("div");
    incomeDiv.className = "info-box income-box";

    const rollInfo = incomeResult.sides 
      ? `D${incomeResult.sides} Roll: <strong>${incomeResult.roll}</strong>`
      : '';
    
    const calculation = incomeResult.multiplier > 1 
      ? ` × ${incomeResult.multiplier} = <strong>${incomeResult.amount} credits</strong>`
      : ` = <strong>${incomeResult.amount} credits</strong>`;

    incomeDiv.innerHTML = `💰 <strong>Income:</strong> ${rollInfo}${calculation}`;
    
    return incomeDiv;
  },

  displayNestedEffect(randomEffect, parentDiv) {
    if (!randomEffect) return;

    if (randomEffect.type === 'reroll') {
      const rerollDiv = document.createElement("div");
      rerollDiv.className = "info-box reroll-box";
      rerollDiv.innerHTML = "🔄 <strong>Reroll:</strong> This result requires a reroll.";
      parentDiv.appendChild(rerollDiv);
      return;
    }

    if (randomEffect.type === 'pending_roll') {
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "nested-content mt-15";
      
      const buttonText = document.createElement("div");
      buttonText.className = "info-box mb-10";
      buttonText.innerHTML = `⚡ <strong>Additional Roll Required... Click to proceed.</strong>`;
      buttonContainer.appendChild(buttonText);

      const rollButton = document.createElement("button");
      rollButton.className = "btn";
      rollButton.textContent = `Roll the dice`;
      rollButton.onclick = () => {
        this.rollNestedTable(randomEffect.tableName, buttonContainer);
      };
      buttonContainer.appendChild(rollButton);

      parentDiv.appendChild(buttonContainer);
    }

    if (randomEffect.type === 'nested_table' && randomEffect.result) {
      const nestedContainer = document.createElement("div");
      nestedContainer.className = "nested-content";

      const nestedTitle = document.createElement("div");
      nestedTitle.className = "nested-title";
      nestedTitle.innerHTML = `<strong>➡️ Additional Result:</strong>`;
      nestedContainer.appendChild(nestedTitle);

      const nestedBox = this.createResultBox(
        randomEffect.result,
        randomEffect.roll,
        randomEffect.tableName
      );
      nestedContainer.appendChild(nestedBox);

      // Recursively display nested effects
      if (randomEffect.nestedEffect) {
        this.displayNestedEffect(randomEffect.nestedEffect, nestedContainer);
      }

      parentDiv.appendChild(nestedContainer);
    }
  },

  rollNestedTable(tableName, containerDiv) {
    // Roll the nested table
    const result = LootBoxEngine.rollNestedTable(tableName);

    if (result.error) {
      containerDiv.innerHTML = `<div class="error-box">${result.error}</div>`;
      return;
    }

    // Clear the button container and show the result
    containerDiv.innerHTML = "";

    const nestedTitle = document.createElement("div");
    nestedTitle.className = "nested-title";
    nestedTitle.innerHTML = `<strong>➡️ Additional Result:</strong>`;
    containerDiv.appendChild(nestedTitle);

    const nestedBox = this.createResultBox(
      result.result,
      result.roll,
      result.tableName
    );
    containerDiv.appendChild(nestedBox);

    // Check if there's another nested effect
    if (result.randomEffect) {
      this.displayNestedEffect(result.randomEffect, containerDiv);
    }
  },

  openLootBox() {
    // Mark the run time and show timer
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('lootBoxLastRun');
      TimerUtil.showTimer('loot-box-timer');
    }

    const resultsContainer = document.getElementById("loot-box-results");
    if (!resultsContainer) return;

    // Clear previous results
    resultsContainer.innerHTML = "";

    // Get loot box result
    const lootResult = LootBoxEngine.openLootBox();

    if (lootResult.error) {
      resultsContainer.innerHTML = `<div class="error-box">${lootResult.error}</div>`;
      return;
    }

    // Create main result container
    const mainContainer = document.createElement("div");
    mainContainer.classList.add('mt-20');

    // Display title
    const title = document.createElement("h3");
    title.textContent = "Loot Box Contents:";
    title.classList.add('mb-15');
    mainContainer.appendChild(title);

    // Display main result
    const resultBox = this.createResultBox(lootResult.result, lootResult.roll);
    mainContainer.appendChild(resultBox);

    // Display income if present
    if (lootResult.incomeResult) {
      const incomeBox = this.createIncomeBox(lootResult.incomeResult);
      mainContainer.appendChild(incomeBox);
    }

    // Display random effects (nested tables)
    if (lootResult.randomEffect) {
      this.displayNestedEffect(lootResult.randomEffect, mainContainer);
    }

    resultsContainer.appendChild(mainContainer);

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};
