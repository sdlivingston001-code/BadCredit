// territoryUI.js

const TerritoryUI = {
  territories: [],
  territoryMap: {},

 async init(jsonPath) {
  try {
    const response = await fetch(jsonPath);
    if (!response.ok) {
      throw new Error(`Failed to load territories: ${response.status}`);
    }

    this.territories = await response.json();

    // ✅ Convert object → array if needed
    if (!Array.isArray(this.territories)) {
      this.territories = Object.entries(this.territories).map(([id, data]) => ({
        id,
        ...data
      }));
    }

    // Load gangs data
    const baseUrl = window.location.pathname.includes('/BadCredit/') ? '/BadCredit' : '';
    const gangsResponse = await fetch(`${baseUrl}/data/gangs.json`);
    if (gangsResponse.ok) {
      this.gangs = await gangsResponse.json();
    } else {
      this.gangs = [];
    }

    this.buildTerritoryMap();
    this.renderGangSelector();
    this.renderCheckboxes();
    this.bindEvents();
  } catch (err) {
    console.error(err);
    const container = document.getElementById("territory-container");
    if (container) {
      container.textContent = "Error loading territories data.";
    }
  }
},

  buildTerritoryMap() {
    this.territories.forEach(t => {
      // Expecting each territory to have a unique `id`
      this.territoryMap[t.id] = t;
    });
  },

  renderGangSelector() {
    const container = document.getElementById("territory-container");
    if (!container) return;

    // Create gang selector wrapper
    const selectorWrapper = document.createElement("div");
    selectorWrapper.className = "gang-selector-wrapper";
    selectorWrapper.style.marginBottom = "20px";
    selectorWrapper.style.paddingBottom = "20px";
    selectorWrapper.style.borderBottom = "2px solid #ccc";

    const label = document.createElement("label");
    label.setAttribute("for", "gang-select");
    label.textContent = "Select Gang: ";
    label.style.fontWeight = "bold";
    label.style.marginRight = "10px";

    const select = document.createElement("select");
    select.id = "gang-select";
    select.style.padding = "5px";
    select.style.fontSize = "14px";

    // Add default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Select Gang --";
    select.appendChild(defaultOption);

    // Add gang options
    if (this.gangs && this.gangs.length > 0) {
      this.gangs.forEach(gang => {
        const option = document.createElement("option");
        option.value = gang;
        option.textContent = gang;
        select.appendChild(option);
      });
    }

    selectorWrapper.appendChild(label);
    selectorWrapper.appendChild(select);
    container.appendChild(selectorWrapper);
  },

  renderCheckboxes() {
    const container = document.getElementById("territory-container");
    if (!container) return;

    // Don't clear the entire container - just remove old checkboxes
    const oldCheckboxes = container.querySelectorAll(".territory-item");
    oldCheckboxes.forEach(item => item.remove());

    this.territories.forEach(territory => {
      const wrapper = document.createElement("div");
      wrapper.className = "territory-item";

      const id = `territory-${territory.id}`;

      wrapper.innerHTML = `
        <label for="${id}">
          <input type="checkbox"
                 id="${id}"
                 class="territory-checkbox"
                 value="${territory.id}">
          ${territory.name}
        </label>
      `;

      container.appendChild(wrapper);
    });
  },

  bindEvents() {
    const button = document.getElementById("resolve-territories");
    if (!button) return;

    button.addEventListener("click", () => {
      const selectedIds = this.getSelectedTerritoryIds();
      const selectedTerritories = selectedIds.map(id => this.territoryMap[id]);

      // Get selected gang
      const gangSelect = document.getElementById("gang-select");
      const selectedGang = gangSelect ? gangSelect.value : null;

      // Check if any territories have variable dice counts and collect user input
      const userInputCounts = {};
      let needsInput = false;
      
      for (const territory of selectedTerritories) {
        if (territory.income && territory.income.count_min !== undefined && territory.income.count_max !== undefined) {
          const count = prompt(`${territory.name}: How many dice to roll for income? (${territory.income.count_min}-${territory.income.count_max})`);
          if (count === null) {
            // User cancelled
            return;
          }
          const parsedCount = parseInt(count);
          if (isNaN(parsedCount) || parsedCount < territory.income.count_min || parsedCount > territory.income.count_max) {
            alert(`Invalid input. Please enter a number between ${territory.income.count_min} and ${territory.income.count_max}.`);
            return;
          }
          userInputCounts[territory.id] = parsedCount;
          needsInput = true;
        }
      }

      const allResults = TerritoryEngine.resolve_all(selectedTerritories, userInputCounts, selectedGang);
      this.displayResults(allResults.territories, allResults.territoriesWithoutIncome, allResults.territoriesWithoutRecruit, allResults.territoriesWithoutFixedRecruit, allResults.territoriesWithoutReputation, allResults.territoriesWithoutFixedGear, allResults.territoriesWithoutBattleSpecialRules, allResults.territoriesWithoutScenarioSelectionSpecialRules, allResults.territoriesWithNilEvents);
    });
  },

  getSelectedTerritoryIds() {
    const checkboxes = document.querySelectorAll(".territory-checkbox:checked");
    return Array.from(checkboxes).map(cb => cb.value);
  },

  displayResults(results, territoriesWithoutIncome, territoriesWithoutRecruit, territoriesWithoutFixedRecruit, territoriesWithoutReputation, territoriesWithoutFixedGear, territoriesWithoutBattleSpecialRules, territoriesWithoutScenarioSelectionSpecialRules, territoriesWithNilEvents) {
    const resultsContainer = document.getElementById("territory-results");
    if (!resultsContainer) return;

    if (!results || results.length === 0) {
      resultsContainer.innerHTML = "<p>No territories selected.</p>";
      return;
    }

    resultsContainer.innerHTML = "";

    // Display Special Events to resolve first
    if (territoriesWithNilEvents && territoriesWithNilEvents.length > 0) {
      const specialEventsSection = document.createElement("div");
      specialEventsSection.innerHTML = "<h3>\u26a0\ufe0f Special Events to Resolve</h3>";
      const specialEventsList = document.createElement("ul");
      
      territoriesWithNilEvents.forEach(event => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${event.name}:</strong> ${event.description}`;
        specialEventsList.appendChild(li);
      });
      
      specialEventsSection.appendChild(specialEventsList);
      resultsContainer.appendChild(specialEventsSection);
    }

    // Display all income rolls
    const incomeSection = document.createElement("div");
    incomeSection.innerHTML = "<h3>💰 Income Rolls</h3>";
    const incomeList = document.createElement("ul");
    
    let totalCredits = 0;
    const specialEffects = [];
    
    results.forEach(result => {
      // Skip territories with nil events - they'll be shown in Special Events section
      if (result.income && result.income.description && !result.income.nilEventTriggered) {
        const li = document.createElement("li");
        const name = result.territory?.name || result.id || "Unknown territory";
        li.innerHTML = `<strong>${name}:</strong> ${result.income.description}`;
        incomeList.appendChild(li);
        
        // Add to total credits
        if (result.income.credits) {
          totalCredits += result.income.credits;
        }
        
        // Collect special effects
        if (result.territory?.income?.effect) {
          specialEffects.push(`<strong>${name}:</strong> ${result.territory.income.effect}`);
        }
      }
    });
    
    incomeSection.appendChild(incomeList);
    
    // Add total credits
    const totalDiv = document.createElement("div");
    totalDiv.innerHTML = `<p><strong>Total Credits: ${totalCredits}</strong></p>`;
    incomeSection.appendChild(totalDiv);
    
    // Add special effects if any
    if (specialEffects.length > 0) {
      const effectsDiv = document.createElement("div");
      effectsDiv.innerHTML = "<p><em><strong>Special Effects to apply:</strong></em></p>";
      const effectsList = document.createElement("ul");
      specialEffects.forEach(effect => {
        const li = document.createElement("li");
        li.innerHTML = effect;
        effectsList.appendChild(li);
      });
      effectsDiv.appendChild(effectsList);
      incomeSection.appendChild(effectsDiv);
    }
    
    resultsContainer.appendChild(incomeSection);

    // Then display all recruit rolls
    const recruitSection = document.createElement("div");
    recruitSection.innerHTML = "<h3>👥 Random Recruit Rolls</h3>";
    const recruitList = document.createElement("ul");
    
    results.forEach(result => {
      if (result.recruit && result.recruit.description) {
        const li = document.createElement("li");
        const name = result.territory?.name || result.id || "Unknown territory";
        li.innerHTML = `<strong>${name}:</strong> ${result.recruit.description}`;
        recruitList.appendChild(li);
      }
    });
    
    recruitSection.appendChild(recruitList);
    
    resultsContainer.appendChild(recruitSection);

    // Then display all fixed recruit benefits
    const fixedRecruitSection = document.createElement("div");
    fixedRecruitSection.innerHTML = "<h3>🎖️ Fixed Recruit Benefits</h3>";
    const fixedRecruitList = document.createElement("ul");
    
    results.forEach(result => {
      if (result.fixedRecruit && result.fixedRecruit.description) {
        const li = document.createElement("li");
        const name = result.territory?.name || result.id || "Unknown territory";
        li.innerHTML = `<strong>${name}:</strong> ${result.fixedRecruit.description}`;
        fixedRecruitList.appendChild(li);
      }
    });
    
    fixedRecruitSection.appendChild(fixedRecruitList);
    
    resultsContainer.appendChild(fixedRecruitSection);

    // Then display all reputation benefits/penalties
    const reputationSection = document.createElement("div");
    reputationSection.innerHTML = "<h3>⭐ Reputation</h3>";
    const reputationList = document.createElement("ul");
    
    results.forEach(result => {
      if (result.reputation && result.reputation.description) {
        const li = document.createElement("li");
        const name = result.territory?.name || result.id || "Unknown territory";
        li.innerHTML = `<strong>${name}:</strong> ${result.reputation.description}`;
        reputationList.appendChild(li);
      }
    });
    
    reputationSection.appendChild(reputationList);
    
    resultsContainer.appendChild(reputationSection);

    // Then display all fixed gear benefits
    const fixedGearSection = document.createElement("div");
    fixedGearSection.innerHTML = "<h3>⚔️ Fixed Gear</h3>";
    const fixedGearList = document.createElement("ul");
    
    results.forEach(result => {
      if (result.fixedGear && result.fixedGear.description) {
        const li = document.createElement("li");
        const name = result.territory?.name || result.id || "Unknown territory";
        li.innerHTML = `<strong>${name}:</strong> ${result.fixedGear.description}`;
        fixedGearList.appendChild(li);
      }
    });
    
    fixedGearSection.appendChild(fixedGearList);
    
    resultsContainer.appendChild(fixedGearSection);

    // Then display all battle special rules
    const battleSpecialRulesSection = document.createElement("div");
    battleSpecialRulesSection.innerHTML = "<h3>🛡️ Battle Special Rules</h3>";
    const battleSpecialRulesList = document.createElement("ul");
    
    results.forEach(result => {
      if (result.battleSpecialRules && result.battleSpecialRules.description) {
        const li = document.createElement("li");
        const name = result.territory?.name || result.id || "Unknown territory";
        li.innerHTML = `<strong>${name}:</strong> ${result.battleSpecialRules.description}`;
        battleSpecialRulesList.appendChild(li);
      }
    });
    
    battleSpecialRulesSection.appendChild(battleSpecialRulesList);
    
    resultsContainer.appendChild(battleSpecialRulesSection);

    // Then display all scenario selection special rules
    const scenarioSelectionSpecialRulesSection = document.createElement("div");
    scenarioSelectionSpecialRulesSection.innerHTML = "<h3>🎲 Scenario Selection Special Rules</h3>";
    const scenarioSelectionSpecialRulesList = document.createElement("ul");
    
    results.forEach(result => {
      if (result.scenarioSelectionSpecialRules && result.scenarioSelectionSpecialRules.description) {
        const li = document.createElement("li");
        const name = result.territory?.name || result.id || "Unknown territory";
        li.innerHTML = `<strong>${name}:</strong> ${result.scenarioSelectionSpecialRules.description}`;
        scenarioSelectionSpecialRulesList.appendChild(li);
      }
    });
    
    scenarioSelectionSpecialRulesSection.appendChild(scenarioSelectionSpecialRulesList);
    
    resultsContainer.appendChild(scenarioSelectionSpecialRulesSection);

    // Display all territories without rules in a single section at the bottom
    const hasAnyWithoutRules = (territoriesWithoutIncome && territoriesWithoutIncome.length > 0) ||
                               (territoriesWithoutRecruit && territoriesWithoutRecruit.length > 0) ||
                               (territoriesWithoutFixedRecruit && territoriesWithoutFixedRecruit.length > 0) ||
                               (territoriesWithoutReputation && territoriesWithoutReputation.length > 0) ||
                               (territoriesWithoutFixedGear && territoriesWithoutFixedGear.length > 0) ||
                               (territoriesWithoutBattleSpecialRules && territoriesWithoutBattleSpecialRules.length > 0) ||
                               (territoriesWithoutScenarioSelectionSpecialRules && territoriesWithoutScenarioSelectionSpecialRules.length > 0);
    
    if (hasAnyWithoutRules) {
      const nullResponsesSection = document.createElement("div");
      nullResponsesSection.innerHTML = "<br><br><br><h3>📋 Territories Without Rules</h3>";
      const nullResponsesList = document.createElement("ul");
      
      if (territoriesWithoutIncome && territoriesWithoutIncome.length > 0) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>No income:</strong> ${territoriesWithoutIncome.join(', ')}`;
        nullResponsesList.appendChild(li);
      }
      
      if (territoriesWithoutRecruit && territoriesWithoutRecruit.length > 0) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>No random recruit benefit:</strong> ${territoriesWithoutRecruit.join(', ')}`;
        nullResponsesList.appendChild(li);
      }
      
      if (territoriesWithoutFixedRecruit && territoriesWithoutFixedRecruit.length > 0) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>No fixed recruit benefit:</strong> ${territoriesWithoutFixedRecruit.join(', ')}`;
        nullResponsesList.appendChild(li);
      }
      
      if (territoriesWithoutReputation && territoriesWithoutReputation.length > 0) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>No reputation effect:</strong> ${territoriesWithoutReputation.join(', ')}`;
        nullResponsesList.appendChild(li);
      }
      
      if (territoriesWithoutFixedGear && territoriesWithoutFixedGear.length > 0) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>No fixed gear:</strong> ${territoriesWithoutFixedGear.join(', ')}`;
        nullResponsesList.appendChild(li);
      }
      
      if (territoriesWithoutBattleSpecialRules && territoriesWithoutBattleSpecialRules.length > 0) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>No battle special rules:</strong> ${territoriesWithoutBattleSpecialRules.join(', ')}`;
        nullResponsesList.appendChild(li);
      }
      
      if (territoriesWithoutScenarioSelectionSpecialRules && territoriesWithoutScenarioSelectionSpecialRules.length > 0) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>No scenario selection special rules:</strong> ${territoriesWithoutScenarioSelectionSpecialRules.join(', ')}`;
        nullResponsesList.appendChild(li);
      }
      
      nullResponsesSection.appendChild(nullResponsesList);
      resultsContainer.appendChild(nullResponsesSection);
    }

  }
};
