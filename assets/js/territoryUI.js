// territoryUI.js

const TerritoryUI = {
  territories: [],
  territoryMap: {},

 async init(jsonPath) {
  try {
    const response = await fetch(`${jsonPath}?t=${Date.now()}`, { cache: 'no-store' });
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
    const gangsResponse = await fetch(`${baseUrl}/data/gangs.json?t=${Date.now()}`, { cache: 'no-store' });
    if (gangsResponse.ok) {
      this.gangs = await gangsResponse.json();
      console.log('Loaded gangs:', this.gangs);
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
    if (this.gangs && typeof this.gangs === 'object') {
      Object.entries(this.gangs).forEach(([id, gangData]) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = gangData.name;
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

      // Validate gang selection
      const warningDiv = document.getElementById("gang-selection-warning") || this.createWarningDiv();
      if (!selectedGang) {
        warningDiv.innerHTML = "<p style='color: red; font-weight: bold;'>⚠️ Please select a gang from the dropdown before resolving territories.</p>";
        warningDiv.style.display = "block";
        return;
      }
      warningDiv.style.display = "none";

      // Check if any territories have variable dice counts and collect user input
      const userInputCounts = {};
      let needsInput = false;
      
      for (const territory of selectedTerritories) {
        // Check for gang-specific income override first
        let incomeConfig = territory.income;
        if (selectedGang) {
          const gangKey = `income_${selectedGang}`;
          if (territory[gangKey]) {
            incomeConfig = territory[gangKey];
          }
        }
        
        // Only prompt if this income config has count_min/count_max (not fixed count)
        if (incomeConfig && incomeConfig.count_min !== undefined && incomeConfig.count_max !== undefined) {
          const count = prompt(`${territory.name}: ${incomeConfig.count_message || `How many dice to roll for income? (${incomeConfig.count_min}-${incomeConfig.count_max})`}`);
          if (count === null) {
            // User cancelled
            return;
          }
          const parsedCount = parseInt(count);
          if (isNaN(parsedCount) || parsedCount < incomeConfig.count_min || parsedCount > incomeConfig.count_max) {
            alert(`Invalid input. Please enter a number between ${incomeConfig.count_min} and ${incomeConfig.count_max}.`);
            return;
          }
          // Apply count_multiplier if it exists
          const finalCount = incomeConfig.count_multiplier ? parsedCount * incomeConfig.count_multiplier : parsedCount;
          userInputCounts[territory.id] = finalCount;
          needsInput = true;
        }
      }

      const allResults = TerritoryEngine.resolve_all(selectedTerritories, userInputCounts, selectedGang);
      this.displayResults(allResults.territories, allResults.territoriesWithoutIncome, allResults.territoriesWithoutRecruit, allResults.territoriesWithoutFixedRecruit, allResults.territoriesWithoutReputation, allResults.territoriesWithoutFixedGear, allResults.territoriesWithoutBattleSpecialRules, allResults.territoriesWithoutScenarioSelectionSpecialRules, allResults.territoriesWithEvents);
    });
  },

  createWarningDiv() {
    const warningDiv = document.createElement("div");
    warningDiv.id = "gang-selection-warning";
    warningDiv.style.display = "none";
    warningDiv.style.marginTop = "10px";
    
    const button = document.getElementById("resolve-territories");
    if (button && button.parentNode) {
      button.parentNode.insertBefore(warningDiv, button.nextSibling);
    }
    
    return warningDiv;
  },

  getSelectedTerritoryIds() {
    const checkboxes = document.querySelectorAll(".territory-checkbox:checked");
    return Array.from(checkboxes).map(cb => cb.value);
  },

  // Helper: Create a results section with title and list of items
  createResultSection(title, icon, results, propertyName, formatter = null) {
    const section = document.createElement("div");
    section.innerHTML = `<h3>${icon} ${title}</h3>`;
    const list = document.createElement("ul");
    
    results.forEach(result => {
      const data = result[propertyName];
      if (data && data.description) {
        const li = document.createElement("li");
        const name = result.territory?.name || result.id || "Unknown territory";
        const description = formatter ? formatter(data, result) : data.description;
        li.innerHTML = `<strong>${name}:</strong> ${description}`;
        list.appendChild(li);
      }
    });
    
    section.appendChild(list);
    return section;
  },

  // Helper: Create "without rules" list items
  createWithoutRulesItems(categoriesWithout) {
    const items = [];
    categoriesWithout.forEach(({ label, territories }) => {
      if (territories && territories.length > 0) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${label}:</strong> ${territories.join(', ')}`;
        items.push(li);
      }
    });
    return items;
  },

  displayResults(results, territoriesWithoutIncome, territoriesWithoutRecruit, territoriesWithoutFixedRecruit, territoriesWithoutReputation, territoriesWithoutFixedGear, territoriesWithoutBattleSpecialRules, territoriesWithoutScenarioSelectionSpecialRules, territoriesWithEvents) {
    const resultsContainer = document.getElementById("territory-results");
    if (!resultsContainer) return;

    if (!results || results.length === 0) {
      resultsContainer.innerHTML = "<p>No territories selected.</p>";
      return;
    }

    resultsContainer.innerHTML = "";

    // Special Events section
    if (territoriesWithEvents && territoriesWithEvents.length > 0) {
      const section = this.createResultSection("Special Events to Resolve", "⚠️", 
        territoriesWithEvents.map(e => ({ id: e.id, territory: { name: e.name }, event: { description: e.description } })),
        'event'
      );
      resultsContainer.appendChild(section);
    }

    // Income section with total and special effects
    const incomeSection = this.createResultSection("Income Rolls", "💰", results, 'income');
    
    let totalCredits = 0;
    const specialEffects = [];
    results.forEach(result => {
      if (result.income && result.income.credits) {
        totalCredits += result.income.credits;
      }
      if (result.territory?.income?.effect) {
        const name = result.territory?.name || result.id;
        specialEffects.push(`<strong>${name}:</strong> ${result.territory.income.effect}`);
      }
    });
    
    const totalDiv = document.createElement("div");
    totalDiv.innerHTML = `<p><strong>Total Credits: ${totalCredits}</strong></p>`;
    incomeSection.appendChild(totalDiv);
    
    if (specialEffects.length > 0) {
      const effectsDiv = document.createElement("div");
      effectsDiv.innerHTML = "<p><em><strong>Special Effects to apply manually:</strong></em></p>";
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

    // All other sections
    const sections = [
      { title: "Random Recruit Rolls", icon: "👥", property: "recruit" },
      { title: "Fixed Recruit Benefits", icon: "🎖️", property: "fixedRecruit" },
      { title: "Reputation", icon: "⭐", property: "reputation" },
      { title: "Fixed Gear", icon: "⚔️", property: "fixedGear" },
      { title: "Battle Special Rules", icon: "🛡️", property: "battleSpecialRules" },
      { title: "Scenario Selection Special Rules", icon: "🎲", property: "scenarioSelectionSpecialRules" }
    ];

    sections.forEach(({ title, icon, property }) => {
      resultsContainer.appendChild(this.createResultSection(title, icon, results, property));
    });

    // Territories without rules section
    const withoutRulesCategories = [
      { label: "No income", territories: territoriesWithoutIncome },
      { label: "No random recruit benefit", territories: territoriesWithoutRecruit },
      { label: "No fixed recruit benefit", territories: territoriesWithoutFixedRecruit },
      { label: "No reputation effect", territories: territoriesWithoutReputation },
      { label: "No fixed gear", territories: territoriesWithoutFixedGear },
      { label: "No battle special rules", territories: territoriesWithoutBattleSpecialRules },
      { label: "No scenario selection special rules", territories: territoriesWithoutScenarioSelectionSpecialRules }
    ];

    const withoutRulesItems = this.createWithoutRulesItems(withoutRulesCategories);
    if (withoutRulesItems.length > 0) {
      const section = document.createElement("div");
      section.innerHTML = "<br><br><br><h3>📋 Territories Without Rules</h3>";
      const list = document.createElement("ul");
      withoutRulesItems.forEach(item => list.appendChild(item));
      section.appendChild(list);
      resultsContainer.appendChild(section);
    }
  }
};
