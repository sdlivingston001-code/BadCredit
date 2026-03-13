// scavengedWeaponsUI.js

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('button').forEach(button => {
    button.classList.add('btn');
  });
});

const ScavengedWeaponsUI = {
  async init(jsonPath) {
    try {
      const response = await fetch(`${jsonPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);

      const data = await response.json();
      ScavengedWeaponsEngine.loadData(data);
      this.bindEvents();
    } catch (err) {
      console.error(err);
      const container = document.getElementById('scavenged-weapons-results');
      if (container) container.innerHTML = '<div class="error-box">Error loading scavenged weapons data.</div>';
    }
  },

  bindEvents() {
    const button = document.getElementById('roll-scavenged-weapon');
    if (button) button.addEventListener('click', () => this.doRoll());
  },

  doRoll() {
    const container = document.getElementById('scavenged-weapons-results');
    if (!container) return;

    const { rolls, total, result, error } = ScavengedWeaponsEngine.roll();

    if (error) {
      container.innerHTML = `<div class="error-box">${error}</div>`;
      return;
    }

    const colour = result.colour || 'grey';
    const effectHtml = result.fixedeffect
      ? `<div class="result-effect">${result.fixedeffect}</div>`
      : '';
    const diceHtml = rolls ? `(${rolls.join(' + ')}) = ` : '';

    container.innerHTML = `
      <div class="result-box result-box-${colour} mt-20">
        <div class="result-heading result-roll"><strong>2D6 Roll:</strong> ${diceHtml}${total}</div>
        <div class="result-heading result-name"><strong>${result.name}</strong></div>
        ${effectHtml}
      </div>
    `;

    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};