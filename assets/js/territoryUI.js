const TerritoryUI = {
  data: null,

  async init(jsonPath) {
    const response = await fetch(jsonPath);
    this.data = await response.json();
    this.renderCheckboxes();
    this.bindEvents();
  },

  renderCheckboxes() {
    const container = document.getElementById("territory-container");

    this.data.forEach(territory => {
      const div = document.createElement("div");

      div.innerHTML = `
        <label>
          <input type="checkbox" class="territory-checkbox" value="${territory.id}">
          ${territory.name}
        </label>
      `;

      container.appendChild(div);
    });
  },

  bindEvents() {
    document.getElementById("resolve-territories")
      .addEventListener("click", () => {
        const selected = [...document.querySelectorAll(".territory-checkbox:checked")]
          .map(cb => cb.value);

        const results = TerritoryEngine.resolve(selected);
        this.displayResults(results);
      });
  },

  displayResults(results) {
    console.log(results);
    // You can expand this to update the DOM
  }
};
