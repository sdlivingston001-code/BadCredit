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

    // Validate territories data if schema validation is available
    if (typeof TerritorySchemas !== 'undefined' && TerritorySchemas.validateAll) {
      const validation = TerritorySchemas.validateAll(this.territories);
      if (!validation.valid) {
        console.warn('Territory validation errors:', validation.errors);
        // Optionally show errors to user in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          alert(`Territory data validation errors:\n${validation.errors.join('\n')}`);
        }
      } else {
        console.log('✓ All territories validated successfully');
      }
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
    this.initTimer();
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

    // Add event listener to show legacy selector when needed
    select.addEventListener('change', () => {
      this.updateLegacySelector(select.value);
    });
  },

  updateLegacySelector(selectedGangKey) {
    const container = document.getElementById("territory-container");
    if (!container) return;

    // Remove existing legacy selector if present
    const existingLegacySelector = document.getElementById("legacy-selector-wrapper");
    if (existingLegacySelector) {
      existingLegacySelector.remove();
    }

    // Check if selected gang has legacy dominionGangId
    if (!selectedGangKey || !this.gangs || !this.gangs[selectedGangKey]) return;

    const selectedGangData = this.gangs[selectedGangKey];
    if (selectedGangData.dominionGangId !== 'legacy') return;

    // Find which legacy type this gang uses
    let legacyType = null;
    if (selectedGangData.legacy_venator === 1) legacyType = 'legacy_venator';
    else if (selectedGangData.legacy_outcast === 1) legacyType = 'legacy_outcast';
    else if (selectedGangData.legacy_secundan_incursion === 1) legacyType = 'legacy_secundan_incursion';

    if (!legacyType) return;

    // Find all gangs that have this legacy type
    const compatibleGangs = Object.entries(this.gangs)
      .filter(([id, gangData]) => gangData[legacyType] === 1 && gangData.dominionGangId !== 'legacy')
      .map(([id, gangData]) => ({ id, name: gangData.name, dominionGangId: gangData.dominionGangId }));

    if (compatibleGangs.length === 0) return;

    // Create legacy selector
    const legacyWrapper = document.createElement("div");
    legacyWrapper.id = "legacy-selector-wrapper";
    legacyWrapper.style.marginBottom = "20px";
    legacyWrapper.style.paddingBottom = "20px";
    legacyWrapper.style.borderBottom = "2px solid #ccc";

    const legacyLabel = document.createElement("label");
    legacyLabel.setAttribute("for", "legacy-gang-select");
    legacyLabel.textContent = "Select House Affiliation: ";
    legacyLabel.style.fontWeight = "bold";
    legacyLabel.style.marginRight = "10px";

    const legacySelect = document.createElement("select");
    legacySelect.id = "legacy-gang-select";
    legacySelect.style.padding = "5px";
    legacySelect.style.fontSize = "14px";

    // Add default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Select House --";
    legacySelect.appendChild(defaultOption);

    // Add compatible gang options
    compatibleGangs.forEach(gang => {
      const option = document.createElement("option");
      option.value = gang.dominionGangId;
      option.textContent = gang.name;
      legacySelect.appendChild(option);
    });

    legacyWrapper.appendChild(legacyLabel);
    legacyWrapper.appendChild(legacySelect);

    // Insert after the gang selector
    const gangSelector = container.querySelector('.gang-selector-wrapper');
    if (gangSelector && gangSelector.nextSibling) {
      container.insertBefore(legacyWrapper, gangSelector.nextSibling);
    } else {
      container.appendChild(legacyWrapper);
    }
  },

  renderCheckboxes() {
    const container = document.getElementById("territory-container");
    if (!container) return;

    // Don't clear the entire container - just remove old checkboxes and sections
    const oldCheckboxes = container.querySelectorAll(".territory-item");
    const oldSections = container.querySelectorAll(".territory-level-section");
    oldCheckboxes.forEach(item => item.remove());
    oldSections.forEach(section => section.remove());

    // Filter territories where campaign = 1 and group by level
    const territoriesByLevel = {};
    this.territories
      .filter(territory => territory.campaign === 1)
      .forEach(territory => {
        const level = territory.level || 1;
        if (!territoriesByLevel[level]) {
          territoriesByLevel[level] = [];
        }
        territoriesByLevel[level].push(territory);
      });

    // Sort territories alphabetically within each level
    Object.keys(territoriesByLevel).forEach(level => {
      territoriesByLevel[level].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Render each level section
    const levels = Object.keys(territoriesByLevel).sort((a, b) => a - b);
    levels.forEach((level, index) => {
      // Create section
      const section = document.createElement("div");
      section.className = "territory-level-section";
      section.style.marginBottom = "20px";
      section.style.paddingBottom = "20px";
      
      // Add dividing line (except for the last section)
      if (index < levels.length - 1) {
        section.style.borderBottom = "2px solid #ccc";
      }

      // Add territories for this level
      territoriesByLevel[level].forEach(territory => {
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

        section.appendChild(wrapper);
      });

      container.appendChild(section);
    });
  },

  bindEvents() {
    const button = document.getElementById("resolve-territories");
    if (!button) return;

    button.addEventListener("click", async () => {
      // Mark the run time and show timer
      if (typeof TimerUtil !== 'undefined') {
        TimerUtil.markRun('territoryLastRun');
        TimerUtil.showTimer('territory-timer');
      }
      
      const selectedIds = this.getSelectedTerritoryIds();
      const selectedTerritories = selectedIds.map(id => this.territoryMap[id]);

      // Get selected gang
      const gangSelect = document.getElementById("gang-select");
      const selectedGangKey = gangSelect ? gangSelect.value : null;

      // Validate gang selection
      const warningDiv = document.getElementById("gang-selection-warning") || this.createWarningDiv();
      if (!selectedGangKey) {
        warningDiv.innerHTML = "<p style='color: red; font-weight: bold;'>⚠️ Please select a gang from the dropdown before resolving territories.</p>";
        warningDiv.style.display = "block";
        return;
      }

      // Get the dominionGangId for the selected gang
      let selectedGang = this.gangs && this.gangs[selectedGangKey] && this.gangs[selectedGangKey].dominionGangId 
        ? this.gangs[selectedGangKey].dominionGangId 
        : selectedGangKey;

      // If legacy gang, check for legacy gang selection
      if (selectedGang === 'legacy') {
        const legacySelect = document.getElementById("legacy-gang-select");
        const legacyGangId = legacySelect ? legacySelect.value : null;
        if (!legacyGangId) {
          warningDiv.innerHTML = "<p style='color: red; font-weight: bold;'>⚠️ Please select a house affiliation from the dropdown before resolving territories.</p>";
          warningDiv.style.display = "block";
          return;
        }
        selectedGang = legacyGangId;
      }
      warningDiv.style.display = "none";

      // Check if any territories need user input and collect it
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
        
        // Resolve schema to get default values like count_min and count_max
        if (incomeConfig && typeof TerritorySchemas !== 'undefined' && TerritorySchemas.resolveProperty) {
          incomeConfig = TerritorySchemas.resolveProperty(incomeConfig, 'income');
        }
        
        // Handle deck-based income (suit guessing)
        if (incomeConfig && incomeConfig.draw_from_deck) {
          const guessedSuit = await this.showSuitSelectionDialog(territory.name);
          if (guessedSuit === null) {
            return;
          }
          userInputCounts[territory.id] = guessedSuit;
          needsInput = true;
        }
        // Handle variable dice count income
        else if (incomeConfig && incomeConfig.count_min !== undefined && incomeConfig.count_max !== undefined) {
          // Replace template variables in message
          let message = incomeConfig.count_message || `How many dice to roll for income? ({count_min} to {count_max})`;
          message = message.replace('{count_min}', incomeConfig.count_min).replace('{count_max}', incomeConfig.count_max);
          
          const count = prompt(`${territory.name}: ${message}`);
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
      this.displayResults(allResults.territories, allResults.territoriesWithoutIncome, allResults.territoriesWithoutRecruit, allResults.territoriesWithoutFixedRecruit, allResults.territoriesWithoutReputation, allResults.territoriesWithoutFixedGear, allResults.territoriesWithoutBattleSpecialRules, allResults.territoriesWithoutTradingSpecialRules, allResults.territoriesWithoutScenarioSelectionSpecialRules, allResults.territoriesWithEvents);
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

  initTimer() {
    // Create timer container below the button
    const button = document.getElementById("resolve-territories");
    if (button && typeof TimerUtil !== 'undefined') {
      const timerContainer = document.createElement("div");
      timerContainer.id = "territory-timer";
      timerContainer.style.marginTop = "15px";
      button.parentNode.insertBefore(timerContainer, button.nextSibling);
      TimerUtil.init('territory-timer', 'territoryLastRun');
      
      // Setup page cleanup to reset timer on navigation
      TimerUtil.setupPageCleanup();
    }
  },

  // Show a custom dialog for suit selection with colored suits
  showSuitSelectionDialog(territoryName) {
    return new Promise((resolve) => {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.className = 'suit-dialog-overlay';

      // Create dialog box
      const dialog = document.createElement('div');
      dialog.className = 'suit-dialog';

      dialog.innerHTML = `
        <h2>${territoryName}</h2>
        <p>Pick a suit:</p>
        <div class="suit-button-grid">
          <button class="suit-button" data-suit="♠">
            <span class="suit-symbol black">♠</span>
            <span class="suit-name">Spades</span>
          </button>
          <button class="suit-button" data-suit="♥">
            <span class="suit-symbol red">♥</span>
            <span class="suit-name">Hearts</span>
          </button>
          <button class="suit-button" data-suit="♦">
            <span class="suit-symbol red">♦</span>
            <span class="suit-name">Diamonds</span>
          </button>
          <button class="suit-button" data-suit="♣">
            <span class="suit-symbol black">♣</span>
            <span class="suit-name">Clubs</span>
          </button>
        </div>
        <button class="cancel-button">Cancel</button>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // Suit button click handlers
      const suitButtons = dialog.querySelectorAll('.suit-button');
      suitButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const suit = btn.getAttribute('data-suit');
          document.body.removeChild(overlay);
          resolve(suit);
        });
      });

      // Cancel button
      const cancelButton = dialog.querySelector('.cancel-button');
      cancelButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
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

  displayResults(results, territoriesWithoutIncome, territoriesWithoutRecruit, territoriesWithoutFixedRecruit, territoriesWithoutReputation, territoriesWithoutFixedGear, territoriesWithoutBattleSpecialRules, territoriesWithoutTradingSpecialRules, territoriesWithoutScenarioSelectionSpecialRules, territoriesWithEvents) {
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
      { title: "Scenario Selection Special Rules", icon: "🎲", property: "scenarioSelectionSpecialRules" },
      { title: "Fixed Gear", icon: "⚔️", property: "fixedGear" },
      { title: "Battle Special Rules", icon: "🛡️", property: "battleSpecialRules" },
      { title: "Trading / Post Battle Action Special Rules", icon: "💼", property: "tradingSpecialRules" }
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
      { label: "No scenario selection special rules", territories: territoriesWithoutScenarioSelectionSpecialRules },
      { label: "No fixed gear", territories: territoriesWithoutFixedGear },
      { label: "No battle special rules", territories: territoriesWithoutBattleSpecialRules },
      { label: "No trading / post battle action special rules", territories: territoriesWithoutTradingSpecialRules }
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
