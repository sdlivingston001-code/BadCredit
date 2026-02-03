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

    this.buildTerritoryMap();
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

  renderCheckboxes() {
    const container = document.getElementById("territory-container");
    if (!container) return;

    container.innerHTML = "";

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

      const results = TerritoryEngine.resolveAll(selectedTerritories);
      this.displayResults(results);
    });
  },

  getSelectedTerritoryIds() {
    const checkboxes = document.querySelectorAll(".territory-checkbox:checked");
    return Array.from(checkboxes).map(cb => cb.value);
  },

  displayResults(results) {
    const resultsContainer = document.getElementById("territory-results");
    if (!resultsContainer) return;

    if (!results || results.length === 0) {
      resultsContainer.innerHTML = "<p>No territories selected.</p>";
      return;
    }

    resultsContainer.innerHTML = "";

    // Display all income rolls first
    const incomeSection = document.createElement("div");
    incomeSection.innerHTML = "<h3>💰 Income Rolls</h3>";
    const incomeList = document.createElement("ul");
    
    let totalCredits = 0;
    const specialEffects = [];
    
    results.forEach(result => {
      if (result.income) {
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
      effectsDiv.innerHTML = "<p><em>Special Effects:</em></p>";
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
    recruitSection.innerHTML = "<h3>👥 Recruit Rolls</h3>";
    const recruitList = document.createElement("ul");
    
    results.forEach(result => {
      if (result.recruit) {
        const li = document.createElement("li");
        const name = result.territory?.name || result.id || "Unknown territory";
        li.innerHTML = `<strong>${name}:</strong> ${result.recruit.description}`;
        recruitList.appendChild(li);
      }
    });
    
    recruitSection.appendChild(recruitList);
    resultsContainer.appendChild(recruitSection);
  }
};
