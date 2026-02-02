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

      const results = TerritoryEngine.resolve(selectedTerritories);
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

    const list = document.createElement("ul");

    results.forEach(result => {
      const li = document.createElement("li");
      const name = result.territory?.name || result.id || "Unknown territory";

      li.textContent = `${name}: roll ${result.roll} → ${result.effect}`;
      list.appendChild(li);
    });

    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(list);
  }
};
