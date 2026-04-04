/**
 * territoryUI.js — Territory tool front-end.
 *
 * Renders the territory selection UI (checkboxes, gang selector, legacy
 * house-affiliation selector) and handles the full resolution workflow:
 *
 *   1. Player selects territories + gang
 *   2. For territories that need user input (dice count, suit guess,
 *      collapsed-dome injury, waste-lurker fighter pick) a modal dialog
 *      is shown
 *   3. TerritoryEngine.resolve_all() is called
 *   4. Results are rendered into result sections with income totals,
 *      recruit outcomes, special rules, and event panels
 *
 * Also renders a collapsible territory reference table that updates
 * when the gang selection changes to show gang-specific overrides.
 *
 * Depends on: dice.js, icons.js, timer.js, territorySchemas.js,
 *             territoryEngine.js, lastingInjuriesEngine.js (optional),
 *             injuryRenderer.js (optional)
 */

import { Icons } from './icons.js';
import { TimerUtil } from './timer.js';
import { TerritorySchemas } from './territorySchemas.js';
import { TerritoryEngine } from './territoryEngine.js';
import { LastingInjuriesEngine } from './lastingInjuriesEngine.js';
import { InjuryRenderer } from './injuryRenderer.js';
import { fetchJSON } from './dataLoader.js';

export const TerritoryUI = {
  territories: [],
  territoryMap: {},
  gangs: null,
  lastingInjuriesData: null,

  async init(jsonPath, gangsPath, lastingInjuriesPath) {
    try {
      this.territories = await fetchJSON(jsonPath);

      if (!Array.isArray(this.territories)) {
        this.territories = Object.entries(this.territories).map(([id, data]) => ({ id, ...data }));
      }

      const validation = TerritorySchemas.validateAll(this.territories);
      if (!validation.valid) {
        console.warn('Territory validation errors:', validation.errors);
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          alert(`Territory data validation errors:\n${validation.errors.join('\n')}`);
        }
      }

      try { this.gangs = await fetchJSON(gangsPath); } catch (e) { this.gangs = {}; }

      if (lastingInjuriesPath) {
        try {
          this.lastingInjuriesData = await fetchJSON(lastingInjuriesPath);
          LastingInjuriesEngine.loadInjuries(this.lastingInjuriesData);
        } catch (e) { /* optional dependency */ }
      }

      this.buildTerritoryMap();
      this.renderGangSelector();
      this.renderCheckboxes();
      this.bindEvents();
      this.initTimer();
      this.renderReferenceTable();
    } catch (err) {
      console.error(err);
      const container = document.getElementById('territory-container');
      if (container) container.textContent = 'Error loading territories data.';
    }
  },

  buildTerritoryMap() {
    this.territories.forEach(t => {
      this.territoryMap[t.id] = t;
    });
  },
  renderGangSelector() {
    const container = document.getElementById('territory-container');
    if (!container) return;

    const optionsHTML = (this.gangs && typeof this.gangs === 'object')
      ? Object.entries(this.gangs)
          .map(([id, gangData]) => `<option value="${id}">${gangData.name}</option>`)
          .join('')
      : '';

    const selectorWrapper = document.createElement('div');
    selectorWrapper.className = 'selector-wrapper with-divider';
    selectorWrapper.innerHTML = `
      <label class="selector-label" for="gang-select">Select Gang: </label>
      <select id="gang-select" class="select-input select-input-small">
        <option value="">-- Select Gang --</option>
        ${optionsHTML}
      </select>
    `;
    container.appendChild(selectorWrapper);

    selectorWrapper.querySelector('#gang-select').addEventListener('change', (e) => {
      this.updateLegacySelector(e.target.value);
      this.renderCheckboxes();
      const gangData = e.target.value && this.gangs && this.gangs[e.target.value];
      const dominionGangId = gangData && gangData.dominionGangId !== 'legacy' ? gangData.dominionGangId : null;
      this.renderReferenceTable(dominionGangId);
    });
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

    legacyWrapper.querySelector('#legacy-gang-select').addEventListener('change', (e) => {
      this.renderReferenceTable(e.target.value || null);
    });

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

    // Preserve current checked state before clearing
    const previouslyChecked = new Set(
      [...container.querySelectorAll('.territory-checkbox:checked')].map(cb => cb.value)
    );
    const previouslyCounts = {};
    container.querySelectorAll('.territory-count-input').forEach(input => {
      previouslyCounts[input.id] = input.value;
    });

    // Don't clear the entire container - just remove old checkboxes and sections
    const oldCheckboxes = container.querySelectorAll(".territory-item");
    const oldSections = container.querySelectorAll(".territory-level-section");
    oldCheckboxes.forEach(item => item.remove());
    oldSections.forEach(section => section.remove());

    // Filter territories
    let territoriesToShow = this.territories.filter(territory => territory.campaign === 1);

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

        wrapper.innerHTML = `
          <label for="${id}">
            <input type="checkbox"
                   id="${id}"
                   class="territory-checkbox"
                   value="${territory.id}">
            <span>${territory.name}</span>
            <input type="number"
                   id="${countInputId}"
                   class="territory-count-input hidden"
                   min="1"
                   max="10"
                   value="1">
          </label>
        `;

        section.appendChild(wrapper);

        const checkbox = wrapper.querySelector(`#${id}`);
        const countInput = wrapper.querySelector(`#${countInputId}`);

        // Restore previous checked state
        if (previouslyChecked.has(territory.id)) {
          checkbox.checked = true;
          const savedCount = previouslyCounts[countInputId];
          if (savedCount) countInput.value = savedCount;
          countInput.classList.remove('hidden');
        }

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
      }
      
      const selectedIds = this.getSelectedTerritoriesWithCounts();
      const selectedTerritories = selectedIds.map(id => this.territoryMap[id]);

      // Get selected gang
      const gangSelect = document.getElementById("gang-select");
      const selectedGangKey = gangSelect ? gangSelect.value : null;

      // Validate gang selection
      const warningDiv = document.getElementById("gang-selection-warning") || this.createWarningDiv();
      if (!selectedGangKey) {
        warningDiv.innerHTML = `<p class='error-box'>${Icons.warning} Please select a gang from the dropdown before resolving territories.</p>`;
        warningDiv.classList.remove('hidden');
        return;
      }

      let selectedGang = this.gangs && this.gangs[selectedGangKey] && this.gangs[selectedGangKey].dominionGangId
          ? this.gangs[selectedGangKey].dominionGangId
          : selectedGangKey;

      // If legacy gang, check for legacy gang selection
      // Allows gangs, such as Venators, to access the special rules of their affiliated legacy gang (e.g. House Cawdor) when resolving territories
      if (selectedGang === 'legacy') {
        const legacySelect = document.getElementById("legacy-gang-select");
        const legacyGangId = legacySelect ? legacySelect.value : null;
        if (!legacyGangId) {
          warningDiv.innerHTML = `<p class='error-box'>${Icons.warning} Please select a house affiliation from the dropdown before resolving territories.</p>`;
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
          message = message.replace(/\n/g, '<br>');

          const parsedCount = await this.showNumberInputDialog(territory.name, message, incomeConfig.count_min, incomeConfig.count_max);
          if (parsedCount === null) {
            return;
          }
          // Apply count_multiplier if it exists
          const finalCount = incomeConfig.count_multiplier ? parsedCount * incomeConfig.count_multiplier : parsedCount;
          userInputCounts[territory.id] = finalCount;
          needsInput = true;
        }
      }

      const allResults = TerritoryEngine.resolve_all(selectedTerritories, userInputCounts, selectedGang);

      // For events that need a random fighter, prompt for gang size then pick one
      for (const event of allResults.territoriesWithEvents) {
        if (event.id === 'collapsed_dome' && typeof LastingInjuriesEngine !== 'undefined' && this.lastingInjuriesData) {
          const input = await this.showCollapsedDomeInjuryDialog(event.name);
          if (input) {
            const { totalFighters, injuryMode } = input;
            LastingInjuriesEngine.setMode(injuryMode);
            const fighterNumber = Dice.d(totalFighters);
            const injuryResult = LastingInjuriesEngine.resolveInjury();
            event.injuryData = { fighterNumber, totalFighters, injuryMode, injuryResult };
          }
        } else if (event.id === 'refuse_drift') {
          const totalFighters = await this.showFighterCountDialog(event.name, 'A waste-lurker attacks! Which fighter must miss the next battle?');
          if (totalFighters !== null) {
            const fighterNumber = Dice.d(totalFighters);
            event.missNextBattle = { fighterNumber, totalFighters };
          }
        }
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
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.init('page-roll-info', 'territoryLastRun');
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

  showFighterCountDialog(territoryName, contextMessage) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'suit-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'suit-dialog';

      dialog.innerHTML = `
        <h2>${territoryName}</h2>
        <p class="number-input-message">${contextMessage}</p>
        <div style="text-align:left; margin-bottom:1.5rem;">
          <label style="display:block;margin-bottom:0.35rem;color:#333;font-weight:bold;">How many fighters are in your gang?</label>
          <input type="number" class="number-input-field" min="1" max="50" value="1" style="display:inline-block;margin:0;">
        </div>
        <div class="number-input-buttons">
          <button class="confirm-button">Roll</button>
          <button class="cancel-button">Cancel</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const input = dialog.querySelector('.number-input-field');
      const confirmButton = dialog.querySelector('.confirm-button');
      const cancelButton = dialog.querySelector('.cancel-button');

      const confirm = () => {
        const val = parseInt(input.value);
        if (isNaN(val) || val < 1) {
          input.classList.add('input-error');
          return;
        }
        document.body.removeChild(overlay);
        resolve(val);
      };

      confirmButton.addEventListener('click', confirm);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirm();
        if (e.key === 'Escape') { document.body.removeChild(overlay); resolve(null); }
      });
      cancelButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); }
      });

      setTimeout(() => input.focus(), 50);
    });
  },

  showCollapsedDomeInjuryDialog(territoryName) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'suit-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'suit-dialog';

      const injuryModes = [
        { value: 'standard_lasting_injuries', label: 'House Rules (D66)' },
        { value: 'standard_lasting_injuries_core', label: 'Core Rules (D66)' },
        { value: 'ironman_lasting_injuries', label: 'Ironman (D6)' },
      ];
      const modeOptions = injuryModes.map(m => `<option value="${m.value}">${m.label}</option>`).join('');

      dialog.innerHTML = `
        <h2>${territoryName}</h2>
        <p class="number-input-message">A section of the dome has caved in!<br>A random fighter suffers a lasting injury.</p>
        <div style="text-align:left; margin-bottom:1rem;">
          <label style="display:block;margin-bottom:0.35rem;color:#333;font-weight:bold;">How many fighters are in your gang?</label>
          <input type="number" class="number-input-field" min="1" max="50" value="1" style="display:inline-block;margin:0 0 0 0;">
        </div>
        <div style="text-align:left; margin-bottom:1.5rem;">
          <label style="display:block;margin-bottom:0.35rem;color:#333;font-weight:bold;">Select injury table:</label>
          <select class="select-input select-input-small collapse-injury-mode">${modeOptions}</select>
        </div>
        <div class="number-input-buttons">
          <button class="confirm-button">Roll Injury</button>
          <button class="cancel-button">Cancel</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const input = dialog.querySelector('.number-input-field');
      const modeSelect = dialog.querySelector('.collapse-injury-mode');
      const confirmButton = dialog.querySelector('.confirm-button');
      const cancelButton = dialog.querySelector('.cancel-button');

      const confirm = () => {
        const totalFighters = parseInt(input.value);
        if (isNaN(totalFighters) || totalFighters < 1) {
          input.classList.add('input-error');
          return;
        }
        document.body.removeChild(overlay);
        resolve({ totalFighters, injuryMode: modeSelect.value });
      };

      confirmButton.addEventListener('click', confirm);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirm();
        if (e.key === 'Escape') { document.body.removeChild(overlay); resolve(null); }
      });
      cancelButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); }
      });

      setTimeout(() => input.focus(), 50);
    });
  },

  showNumberInputDialog(territoryName, message, min, max) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'suit-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'suit-dialog';

      dialog.innerHTML = `
        <h2>${territoryName}</h2>
        <p class="number-input-message">${message}</p>
        <input type="number" class="number-input-field" min="${min}" max="${max}" value="${min}">
        <div class="number-input-buttons">
          <button class="confirm-button">OK</button>
          <button class="cancel-button">Cancel</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const input = dialog.querySelector('.number-input-field');
      const confirmButton = dialog.querySelector('.confirm-button');
      const cancelButton = dialog.querySelector('.cancel-button');

      const confirm = () => {
        const val = parseInt(input.value);
        if (isNaN(val) || val < min || val > max) {
          input.classList.add('input-error');
          return;
        }
        document.body.removeChild(overlay);
        resolve(val);
      };

      confirmButton.addEventListener('click', confirm);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirm();
        if (e.key === 'Escape') { document.body.removeChild(overlay); resolve(null); }
      });
      cancelButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); }
      });

      setTimeout(() => input.focus(), 50);
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

    if (list.children.length === 0) {
      const li = document.createElement("li");
      li.innerHTML = `<em>None for selected territories.</em>`;
      list.appendChild(li);
    }

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
      const eventsSection = document.createElement("div");
      eventsSection.innerHTML = `<h3>${Icons.warning} Special Events to Resolve</h3>`;
      const eventList = document.createElement("ul");

      territoriesWithEvents.forEach(e => {
        const li = document.createElement("li");
        li.innerHTML = `<b>${e.name}:</b> ${e.description.replace(/⚠️/g, Icons.warning)}`;

        if (e.injuryData) {
          const { fighterNumber, totalFighters, injuryMode, injuryResult } = e.injuryData;
          const dieLabel = injuryMode === 'ironman_lasting_injuries' ? 'D6' : 'D66';

          const injuryContainer = document.createElement("div");
          injuryContainer.className = "mt-10";

          const fighterInfo = document.createElement("p");
          fighterInfo.innerHTML = `<b>D${totalFighters} Roll: ${fighterNumber}</b> — Fighter #${fighterNumber} suffers a lasting injury.`;
          injuryContainer.appendChild(fighterInfo);

          if (typeof InjuryRenderer !== 'undefined') {
            const colour = injuryResult.injury.colour || 'grey';
            const injuryBox = InjuryRenderer.createInjuryBox(
              injuryResult.injury, colour,
              `<b>${dieLabel} Roll:</b> ${injuryResult.roll}`,
              injuryResult.randomRoll
            );
            injuryContainer.appendChild(injuryBox);
            InjuryRenderer.appendStatusWarnings(injuryResult.injury, injuryContainer);
            InjuryRenderer.displayAdditionalInjuries(injuryResult.additionalInjuries, injuryContainer, 'Roll');
          }

          li.appendChild(injuryContainer);
        }

        if (e.missNextBattle) {
          const { fighterNumber, totalFighters } = e.missNextBattle;
          const missContainer = document.createElement("div");
          missContainer.className = "mt-10";
          const fighterInfo = document.createElement("p");
          fighterInfo.innerHTML = `<b>D${totalFighters} Roll: ${fighterNumber}</b> — Fighter #${fighterNumber} must miss the next battle.`;
          missContainer.appendChild(fighterInfo);
          li.appendChild(missContainer);
        }

        eventList.appendChild(li);
      });

      eventsSection.appendChild(eventList);
      resultsContainer.appendChild(eventsSection);
    }

    // Income section with total and special effects
    const incomeSection = this.createResultSection("Income Rolls", Icons.moneyWavy, results, 'income');
    
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
      { title: "Random Recruit Rolls", icon: Icons.users, property: "recruit" },
      { title: "Fixed Recruit Benefits", icon: Icons.userCirclePlus, property: "fixedRecruit" },
      { title: "Reputation", icon: Icons.star, property: "reputation" },
      { title: "Scenario Selection Special Rules", icon: Icons.clipboardList, property: "scenarioSelectionSpecialRules" },
      { title: "Fixed Gear", icon: Icons.gear, property: "fixedGear" },
      { title: "Battle Special Rules", icon: Icons.swords, property: "battleSpecialRules" },
      { title: "Trading / Post Battle Action Special Rules", icon: Icons.magicWand, property: "tradingSpecialRules" }
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
      const details = document.createElement("details");
      details.className = "reference-tables-collapsible mt-30";
      const summary = document.createElement("summary");
      summary.textContent = "Territories Without Rules";
      details.appendChild(summary);
      const list = document.createElement("ul");
      withoutRulesItems.forEach(item => list.appendChild(item));
      details.appendChild(list);
      resultsContainer.appendChild(details);
    }
  },

  // Describe income config accurately from resolved fields
  describeIncome(rawConfig) {
    if (!rawConfig) return null;
    const c = (typeof TerritorySchemas !== 'undefined' && TerritorySchemas.resolveProperty)
      ? TerritorySchemas.resolveProperty(rawConfig, 'income')
      : rawConfig;

    const parts = [];

    if (c.draw_from_deck) {
      parts.push('Draw from deck');
    } else if (c.count_min !== undefined && c.count_max !== undefined) {
      if (c.count_message) parts.push(c.count_message.replace(/\n/g, '<br>'));
      parts.push(`\u00d7 ${c.multiplier} credits per unit`);
      if (c.count_multiplier && c.count_multiplier !== 1) parts.push(`Count multiplier: \u00d7${c.count_multiplier}`);
    } else {
      let formula = `${c.count}d${c.sides} \u00d7 ${c.multiplier} credits`;
      if (c.addition) formula += ` + ${c.addition}`;
      parts.push(formula);
      if (c.required_territory) {
        const condMult = c.conditional_multiplier || c.multiplier;
        const condCount = c.conditional_count || c.count;
        parts.push(`If ${c.required_territory} also held: ${condCount}d${c.sides} \u00d7 ${condMult} credits`);
      }
    }

    if (c.event && c.event.text) parts.push(c.event.text.replace(/⚠️/g, Icons.warning));

    return parts.join('<br>');
  },

  // Describe recruit config with full outcomes table
  describeRecruit(rawConfig) {
    if (!rawConfig) return null;
    const c = (typeof TerritorySchemas !== 'undefined' && TerritorySchemas.resolveProperty)
      ? TerritorySchemas.resolveProperty(rawConfig, 'recruit')
      : rawConfig;
    const parts = [`${c.count}d${c.sides}, success on ${c.target}+`];
    if (c.outcomes) {
      Object.entries(c.outcomes)
        .sort(([a], [b]) => Number(a) - Number(b))
        .forEach(([count, text]) => parts.push(`${count} success${Number(count) !== 1 ? 'es' : ''}: ${text}`));
    }
    return parts.join('<br>');
  },

  // Render the collapsible territory reference table
  renderReferenceTable(selectedGang = null) {
    const container = document.getElementById('territory-reference');
    if (!container) return;
    container.innerHTML = '';

    const campaignTerritories = this.territories.filter(t => t.campaign === 1);

    // Group by level
    const byLevel = {};
    campaignTerritories.forEach(t => {
      const level = t.level || 1;
      if (!byLevel[level]) byLevel[level] = [];
      byLevel[level].push(t);
    });
    Object.values(byLevel).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));

    const outerDetails = document.createElement('details');
    outerDetails.className = 'reference-tables-collapsible';
    const outerSummary = document.createElement('summary');
    outerSummary.textContent = 'Territory Reference (Select a gang to see gang-specific overrides)';
    outerDetails.appendChild(outerSummary);

    const ruleFields = [
      {
        label: 'Income',
        getVal: (t) => {
          const gangKey = `income_${selectedGang}`;
          const isOverride = selectedGang && t[gangKey];
          return { raw: isOverride ? t[gangKey] : t.income, override: !!isOverride, isIncome: true };
        }
      },
      {
        label: 'Random Recruit',
        getVal: (t) => {
          const gangKey = `random_recruit_${selectedGang}`;
          const isOverride = selectedGang && t[gangKey];
          return { raw: isOverride ? t[gangKey] : t.random_recruit, override: !!isOverride, isRecruit: true };
        }
      },
      {
        label: 'Fixed Recruit',
        getVal: (t) => {
          const gangKey = `fixed_recruit_${selectedGang}`;
          const isOverride = selectedGang && t[gangKey];
          return { raw: isOverride ? t[gangKey] : t.fixed_recruit, override: !!isOverride };
        }
      },
      {
        label: 'Reputation',
        getVal: (t) => {
          const gangKey = `reputation_${selectedGang}`;
          const isOverride = selectedGang && t[gangKey];
          return { raw: isOverride ? t[gangKey] : t.reputation, override: !!isOverride };
        }
      },
      {
        label: 'Fixed Gear',
        getVal: (t) => {
          const gangKey = `fixed_gear_${selectedGang}`;
          const isOverride = selectedGang && t[gangKey];
          return { raw: isOverride ? t[gangKey] : t.fixed_gear, override: !!isOverride };
        }
      },
      {
        label: 'Battle Special Rules',
        getVal: (t) => {
          const gangKey = `battle_special_rules_${selectedGang}`;
          const isOverride = selectedGang && t[gangKey];
          return { raw: isOverride ? t[gangKey] : t.battle_special_rules, override: !!isOverride };
        }
      },
      {
        label: 'Trading Special Rules',
        getVal: (t) => {
          const gangKey = `trading_special_rules_${selectedGang}`;
          const isOverride = selectedGang && t[gangKey];
          return { raw: isOverride ? t[gangKey] : t.trading_special_rules, override: !!isOverride };
        }
      },
      {
        label: 'Scenario Selection',
        getVal: (t) => {
          const gangKey = `scenario_selection_special_rules_${selectedGang}`;
          const isOverride = selectedGang && t[gangKey];
          return { raw: isOverride ? t[gangKey] : t.scenario_selection_special_rules, override: !!isOverride };
        }
      }
    ];

    const levels = Object.keys(byLevel).sort((a, b) => Number(a) - Number(b));
    levels.forEach(level => {
      const levelDetails = document.createElement('details');
      levelDetails.className = 'reference-tables-collapsible';
      const levelSummary = document.createElement('summary');
      levelSummary.textContent = `Level ${level}`;
      levelDetails.appendChild(levelSummary);

      byLevel[level].forEach(territory => {
        const nameEl = document.createElement('p');
        nameEl.innerHTML = `<strong>${territory.name}</strong>`;
        levelDetails.appendChild(nameEl);

        const ul = document.createElement('ul');
        ruleFields.forEach(({ label, getVal }) => {
          const { raw, override, isIncome, isRecruit } = getVal(territory);
          if (!raw) return;
          const text = isIncome ? this.describeIncome(raw)
            : isRecruit ? this.describeRecruit(raw)
            : raw;
          if (!text) return;
          const li = document.createElement('li');
          const overrideTag = override ? ` <em>(Gang Override)</em>` : '';
          li.innerHTML = `<b>${label}${overrideTag}:</b> ${text}`;
          ul.appendChild(li);
        });

        levelDetails.appendChild(ul);
      });

      outerDetails.appendChild(levelDetails);
    });

    container.appendChild(outerDetails);
  }
};
