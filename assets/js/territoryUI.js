// territoryUI.js

const TerritoryUI = {
  territories: [],
  territoryMap: {},
  campaignData: null,
  playerGangMapping: null,
  playerGangTerritories: null,
  playerGangTerritoryCounts: null, // Track how many of each territory a gang owns
  territoryNameToIdMap: {},
  campaignIdInput: null,
  setCampaignIdButton: null,

 async init(jsonPath, gangsPath) {
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
      }
    }

    // Load gangs data
    const gangsResponse = await fetch(`${gangsPath}?t=${Date.now()}`, { cache: 'no-store' });
    if (gangsResponse.ok) {
      this.gangs = await gangsResponse.json();
    } else {
      this.gangs = [];
    }

    // Build territory map BEFORE loading campaign data (needed for territory counting)
    this.buildTerritoryMap();

    // Load campaign data if available
    await this.loadCampaignData();

    this.renderGangSelector();
    this.renderCheckboxes();
    this.bindEvents();
    this.initTimer();

    // Wire up campaign ID input
    this.campaignIdInput = document.getElementById('territory-campaign-id-input');
    this.setCampaignIdButton = document.getElementById('territory-set-campaign-id');
    if (this.campaignIdInput && this.setCampaignIdButton) {
      this.campaignIdInput.value = CampaignViewerEngine.getCampaignId();
      this.setCampaignIdButton.addEventListener('click', () => this.setCampaignId());
      this.campaignIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.setCampaignId();
      });
    }
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
      this.territoryMap[t.id] = t;
      const normalizedName = this.normalizeTerritoryName(t.name);
      this.territoryNameToIdMap[normalizedName] = t.id;
    });
  },

  /**
   * Normalize territory name by removing gang-specific suffixes like (*), (AWN), etc.
   * @param {string} name - Territory name from local data
   * @returns {string} Normalized name
   */
  normalizeTerritoryName(name) {
    // Remove patterns like (*), (AWN), (Pal Enf), etc.
    return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  },

  setCampaignId() {
    const newId = this.campaignIdInput ? this.campaignIdInput.value.trim() : '';
    if (!newId) {
      alert('Please enter a valid campaign ID');
      return;
    }
    if (CampaignViewerEngine.setCampaignId(newId)) {
      this.loadCampaignData().then((success) => {
        if (success) {
          this.renderGangSelector();
          this.renderCheckboxes();
        }
      });
    }
  },

  async loadCampaignData() {
    if (typeof CampaignViewerEngine === 'undefined') return false;

    if (!this.gangs || Object.keys(this.gangs).length === 0) {
      console.warn('TerritoryUI: Gangs data not loaded yet');
      return false;
    }

    const container = document.getElementById('territory-container');
    if (container) container.innerHTML = '<div class="info-box warning-box">Fetching campaign data, please wait&hellip;</div>';

    const result = await CampaignViewerEngine.fetchCampaignData(false);

    if (container) container.innerHTML = '';

    if (!result.success) {
      if (container) container.innerHTML = `<div class="error-box">❌ Error fetching campaign data: ${result.error}</div>`;
      return false;
    }

    CampaignViewerEngine.campaignData = result.data;
    this.campaignData = result.data;
    
    // Generate mappings
    this.playerGangMapping = CampaignViewerEngine.getPlayerGangToIdMapping(this.gangs);
    this.playerGangTerritories = CampaignViewerEngine.getPlayerGangTerritories();
    
    // Count territories for each gang (handle duplicates)
    this.playerGangTerritoryCounts = {};
    Object.entries(this.playerGangTerritories).forEach(([gangName, territoryNames]) => {
      const counts = {};
      territoryNames.forEach(name => {
        const normalizedName = this.normalizeTerritoryName(name);
        const territoryId = this.territoryNameToIdMap[normalizedName];
        if (territoryId) {
          counts[territoryId] = (counts[territoryId] || 0) + 1;
        } else {
          console.warn(`TerritoryUI: Could not map territory "${name}" (normalized: "${normalizedName}") to local territory`);
        }
      });
      this.playerGangTerritoryCounts[gangName] = counts;
    });

    return true;
  },

  renderGangSelector() {
    const container = document.getElementById("territory-container");
    if (!container) return;

    let optionsHTML;
    if (this.playerGangMapping && Object.keys(this.playerGangMapping).length > 0) {
      const campaignOptions = Object.entries(this.playerGangMapping)
        .map(([playerGangName, gangId]) =>
          `<option value="player:${playerGangName}" data-gang-id="${gangId}">${playerGangName}</option>`)
        .join('');
      const regularOptions = (this.gangs && typeof this.gangs === 'object')
        ? Object.entries(this.gangs)
            .map(([id, gangData]) => `<option value="${id}">${gangData.name}</option>`)
            .join('')
        : '';
      optionsHTML = `
        <optgroup label="Campaign Gangs">${campaignOptions}</optgroup>
        <optgroup label="All Gang Types">${regularOptions}</optgroup>`;
    } else {
      optionsHTML = (this.gangs && typeof this.gangs === 'object')
        ? Object.entries(this.gangs)
            .map(([id, gangData]) => `<option value="${id}">${gangData.name}</option>`)
            .join('')
        : '';
    }

    const selectorWrapper = document.createElement("div");
    selectorWrapper.className = "selector-wrapper with-divider";
    selectorWrapper.innerHTML = `
      <label class="selector-label" for="gang-select">Select Gang: </label>
      <select id="gang-select" class="select-input select-input-small">
        <option value="">-- Select Gang --</option>
        ${optionsHTML}
      </select>
    `;
    container.appendChild(selectorWrapper);

    selectorWrapper.querySelector('#gang-select').addEventListener('change', (e) => {
      const selectedValue = e.target.value;
      if (selectedValue.startsWith('player:')) {
        this.handlePlayerGangSelection(selectedValue.substring(7));
      } else {
        this.updateLegacySelector(selectedValue);
        this.renderCheckboxes();
      }
    });
  },

  handlePlayerGangSelection(playerGangName) {
    // Get the gang's territories (API names)
    const controlledTerritoryNames = this.playerGangTerritories[playerGangName] || [];
    const territoryCounts = this.playerGangTerritoryCounts[playerGangName] || {};
    
    // Convert API territory names to local territory IDs (normalizing first)
    const controlledTerritoryIds = controlledTerritoryNames
      .map(apiName => {
        const normalizedName = this.normalizeTerritoryName(apiName);
        return this.territoryNameToIdMap[normalizedName];
      })
      .filter(id => id); // Remove undefined values
    
    // Get unique territory IDs
    const uniqueTerritoryIds = [...new Set(controlledTerritoryIds)];
    
    // Re-render checkboxes with filter and counts
    this.renderCheckboxes(uniqueTerritoryIds, territoryCounts);
    
    // Auto-select the controlled territories
    setTimeout(() => {
      uniqueTerritoryIds.forEach(territoryId => {
        const checkbox = document.getElementById(`territory-${territoryId}`);
        const countInput = document.getElementById(`territory-count-${territoryId}`);
        if (checkbox) {
          checkbox.checked = true;
          if (countInput) {
            const count = territoryCounts[territoryId] || 1;
            countInput.value = count;
            countInput.classList.remove('hidden');
          }
        }
      });
    }, 100);
    
    // No legacy selector needed for player gangs
    const existingLegacySelector = document.getElementById("legacy-selector-wrapper");
    if (existingLegacySelector) {
      existingLegacySelector.remove();
    }
  },

  updateLegacySelector(selectedGangKey) {
    const container = document.getElementById("territory-container");
    if (!container) return;

    const existingLegacySelector = document.getElementById("legacy-selector-wrapper");
    if (existingLegacySelector) existingLegacySelector.remove();

    if (!selectedGangKey || !this.gangs || !this.gangs[selectedGangKey]) return;

    const selectedGangData = this.gangs[selectedGangKey];
    if (selectedGangData.dominionGangId !== 'legacy') return;

    let legacyType = null;
    if (selectedGangData.legacy_venator === 1) legacyType = 'legacy_venator';
    else if (selectedGangData.legacy_outcast === 1) legacyType = 'legacy_outcast';
    else if (selectedGangData.legacy_secundan_incursion === 1) legacyType = 'legacy_secundan_incursion';

    if (!legacyType) return;

    const compatibleGangs = Object.entries(this.gangs)
      .filter(([id, gangData]) => gangData[legacyType] === 1 && gangData.dominionGangId !== 'legacy')
      .map(([id, gangData]) => ({ id, name: gangData.name, dominionGangId: gangData.dominionGangId }));

    if (compatibleGangs.length === 0) return;

    const optionsHTML = compatibleGangs
      .map(gang => `<option value="${gang.dominionGangId}">${gang.name}</option>`)
      .join('');

    const legacyWrapper = document.createElement("div");
    legacyWrapper.id = "legacy-selector-wrapper";
    legacyWrapper.className = "selector-wrapper with-divider";
    legacyWrapper.innerHTML = `
      <label class="selector-label" for="legacy-gang-select">Select House Affiliation: </label>
      <select id="legacy-gang-select" class="select-input select-input-small">
        <option value="">-- Select House --</option>
        ${optionsHTML}
      </select>
    `;

    const gangSelector = container.querySelector('.gang-selector-wrapper');
    if (gangSelector && gangSelector.nextSibling) {
      container.insertBefore(legacyWrapper, gangSelector.nextSibling);
    } else {
      container.appendChild(legacyWrapper);
    }
  },

  renderCheckboxes(filterTerritoryIds = null, territoryCounts = null) {
    const container = document.getElementById("territory-container");
    if (!container) return;

    // Don't clear the entire container - just remove old checkboxes and sections
    const oldCheckboxes = container.querySelectorAll(".territory-item");
    const oldSections = container.querySelectorAll(".territory-level-section");
    oldCheckboxes.forEach(item => item.remove());
    oldSections.forEach(section => section.remove());

    // Filter territories
    let territoriesToShow = this.territories.filter(territory => territory.campaign === 1);
    
    // Apply player gang filter if provided
    if (filterTerritoryIds && Array.isArray(filterTerritoryIds) && filterTerritoryIds.length > 0) {
      territoriesToShow = territoriesToShow.filter(territory => 
        filterTerritoryIds.includes(territory.id)
      );
    }

    // Group by level
    const territoriesByLevel = {};
    territoriesToShow.forEach(territory => {
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
      
      // Add dividing line (except for the last section)
      if (index < levels.length - 1) {
        section.classList.add('section-divider');
      }

      // Add territories for this level
      territoriesByLevel[level].forEach(territory => {
        const wrapper = document.createElement("div");
        wrapper.className = "territory-item";

        const id = `territory-${territory.id}`;
        const countInputId = `territory-count-${territory.id}`;
        
        // Check if this territory has multiple copies (from campaign data)
        const count = territoryCounts && territoryCounts[territory.id] ? territoryCounts[territory.id] : null;

        wrapper.innerHTML = `
          <label for="${id}">
            <input type="checkbox"
                   id="${id}"
                   class="territory-checkbox"
                   value="${territory.id}">
            <span>${territory.name}</span>
            <input type="number"
                   id="${countInputId}"
                   class="territory-count-input ${count ? '' : 'hidden'}"
                   min="1"
                   max="10"
                   value="${count || 1}">
          </label>
        `;

        section.appendChild(wrapper);

        const checkbox = wrapper.querySelector(`#${id}`);
        const countInput = wrapper.querySelector(`#${countInputId}`);

        checkbox.addEventListener('change', () => {
          countInput.classList.toggle('hidden', !checkbox.checked);
        });
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
      
      const selectedIds = this.getSelectedTerritoriesWithCounts();
      const selectedTerritories = selectedIds.map(id => this.territoryMap[id]);

      // Get selected gang
      const gangSelect = document.getElementById("gang-select");
      const selectedGangKey = gangSelect ? gangSelect.value : null;

      // Validate gang selection
      const warningDiv = document.getElementById("gang-selection-warning") || this.createWarningDiv();
      if (!selectedGangKey) {
        warningDiv.innerHTML = "<p class='error-box'>⚠️ Please select a gang from the dropdown before resolving territories.</p>";
        warningDiv.classList.remove('hidden');
        return;
      }

      // Get the dominionGangId for the selected gang
      let selectedGang;
      if (selectedGangKey.startsWith('player:')) {
        const playerGangName = selectedGangKey.substring(7);
        const localGangId = this.playerGangMapping && this.playerGangMapping[playerGangName];
        selectedGang = localGangId
          ? (this.gangs[localGangId] && this.gangs[localGangId].dominionGangId || localGangId)
          : selectedGangKey;
      } else {
        selectedGang = this.gangs && this.gangs[selectedGangKey] && this.gangs[selectedGangKey].dominionGangId
          ? this.gangs[selectedGangKey].dominionGangId
          : selectedGangKey;
      }

      // If legacy gang, check for legacy gang selection
      if (selectedGang === 'legacy') {
        const legacySelect = document.getElementById("legacy-gang-select");
        const legacyGangId = legacySelect ? legacySelect.value : null;
        if (!legacyGangId) {
          warningDiv.innerHTML = "<p class='error-box'>⚠️ Please select a house affiliation from the dropdown before resolving territories.</p>";
          warningDiv.classList.remove('hidden');
          return;
        }
        selectedGang = legacyGangId;
      }
      warningDiv.classList.add('hidden');

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

      if (typeof TimerUtil !== 'undefined') {
        const territoryRolls = allResults.territories
          .filter(t => t.income && t.income.rolls && t.income.rolls.length > 0)
          .map(t => `${t.territory.name}: ${t.income.rolls.join('+')} = ${t.income.total}`);
        if (territoryRolls.length > 0) TimerUtil.recordRolls('territoryLastRun', territoryRolls);
      }

      this.displayResults(allResults.territories, allResults.territoriesWithoutIncome, allResults.territoriesWithoutRecruit, allResults.territoriesWithoutFixedRecruit, allResults.territoriesWithoutReputation, allResults.territoriesWithoutFixedGear, allResults.territoriesWithoutBattleSpecialRules, allResults.territoriesWithoutTradingSpecialRules, allResults.territoriesWithoutScenarioSelectionSpecialRules, allResults.territoriesWithEvents);
    });
  },

  createWarningDiv() {
    const warningDiv = document.createElement("div");
    warningDiv.id = "gang-selection-warning";
    warningDiv.className = "hidden mt-10";
    
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

  getSelectedTerritoriesWithCounts() {
    const checkboxes = document.querySelectorAll(".territory-checkbox:checked");
    const result = [];
    
    checkboxes.forEach(checkbox => {
      const territoryId = checkbox.value;
      const countInput = document.getElementById(`territory-count-${territoryId}`);
      const count = countInput ? parseInt(countInput.value) || 1 : 1;
      
      // Add the territory multiple times based on count
      for (let i = 0; i < count; i++) {
        result.push(territoryId);
      }
    });
    
    return result;
  },

  initTimer() {
    // Create timer container below the button
    const button = document.getElementById("resolve-territories");
    if (button && typeof TimerUtil !== 'undefined') {
      const timerContainer = document.createElement("div");
      timerContainer.id = "territory-timer";
      timerContainer.className = "mt-15";
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
        li.innerHTML = `<b>${name}:</b> ${description}`;
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
        li.innerHTML = `<b>${label}:</b> ${territories.join(', ')}`;
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
        specialEffects.push(`<b>${name}:</b> ${result.territory.income.effect}`);
      }
    });
    
    const totalDiv = document.createElement("div");
    totalDiv.innerHTML = `<p><b>Total Credits: ${totalCredits}</b></p>`;
    incomeSection.appendChild(totalDiv);
    
    if (specialEffects.length > 0) {
      const effectsDiv = document.createElement("div");
      effectsDiv.innerHTML = "<p><em><b>Special Effects to apply manually:</b></em></p>";
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
      section.innerHTML = '<h3 class="mt-30">📋 Territories Without Rules</h3>';
      const list = document.createElement("ul");
      withoutRulesItems.forEach(item => list.appendChild(item));
      section.appendChild(list);
      resultsContainer.appendChild(section);
    }
  }
};
