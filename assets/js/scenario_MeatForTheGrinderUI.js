// scenario_MeatForTheGrinderUI.js

const scenario_MeatForTheGrinderUI = {
  async init(jsonPath) {
    try {
      const response = await fetch(`${jsonPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);

      const data = await response.json();
      scenario_MeatForTheGrinderEngine.loadData(data);
      this.bindEvents();
      this.initTimer();
      this.renderWeaponTable(data);
      this.renderRollTable(data);
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

  initTimer() {
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.init('page-roll-info', 'scenario_MeatForTheGrinderLastRun');
      TimerUtil.setupPageCleanup();
    }
  },

  getProfileStats(profile) {
    if (profile.RngS !== undefined || profile.RngL !== undefined) return profile;
    for (const [key, val] of Object.entries(profile)) {
      if (key !== 'name' && typeof val === 'object' && val !== null) {
        return { name: profile.name, ...val };
      }
    }
    return profile;
  },

  renderRollTable(data) {
    const container = document.getElementById('roll-table-container');
    if (!container || !data.scavenged_weapon_roll) return;

    const { results } = data.scavenged_weapon_roll;
    const rows = Object.values(results).map(entry => {
      const rollStr = Array.isArray(entry.values) ? entry.values.join(', ') : entry.values;
      return `<tr><td>${rollStr}</td><td><b>${entry.name}</b></td></tr>`;
    }).join('');

    container.innerHTML = `
      <h3>Scavenged Weapon (2D6)</h3>
      <table>
        <thead><tr><th>Roll</th><th>Weapon</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  },

  renderRollTable(data) {
    const container = document.getElementById('roll-table-container');
    if (!container || !data.scavenged_weapon_roll) return;

    const { results } = data.scavenged_weapon_roll;
    const rows = Object.values(results).map(entry => {
      const rollStr = Array.isArray(entry.values) ? entry.values.join(', ') : entry.values;
      return `<tr><td>${rollStr}</td><td><b>${entry.name}</b></td></tr>`;
    }).join('');

    container.innerHTML = `
      <h3>Scavenged Weapon (2D6)</h3>
      <table>
        <thead><tr><th>Roll</th><th>Weapon</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  },

  renderWeaponTable(data) {
    const container = document.getElementById('weapon-profiles-table');
    if (!container) return;

    const table = data.scavenged_weapon_table;
    if (!table) return;

    const cols = ['Name', 'Rng S', 'Rng L', 'Acc S', 'Acc L', 'Str', 'AP', 'Dam', 'AM', 'Traits'];
    const statKeys = ['name', 'RngS', 'RngL', 'AccS', 'AccL', 'Str', 'AP', 'Dam', 'AM', 'Traits'];

    let rows = '';
    for (const [weaponId, weapon] of Object.entries(table)) {
      const profiles = Object.values(weapon);
      const isMulti = profiles.length > 1;
      profiles.forEach((profile, i) => {
        let cls = '';
        if (isMulti) {
          if (i === 0) cls = 'group-first';
          else if (i === profiles.length - 1) cls = 'group-last';
          else cls = 'group-mid';
        }
        if (profile.header) {
          rows += `<tr${cls ? ` class="${cls}"` : ''}><td colspan="${statKeys.length}" class="weapon-group-header">${profile.name}</td></tr>`;
          return;
        }
        const stats = this.getProfileStats(profile);
        rows += `<tr${cls ? ` class="${cls}"` : ''}>`;
        for (const key of statKeys) {
          const val = stats[key] !== undefined ? stats[key] : '-';
          rows += `<td>${val}</td>`;
        }
        rows += '</tr>';
      });
    }

    container.innerHTML = `
      <table class="weapon-profiles-table">
        <thead>
          <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  },

  doRoll() {
    const container = document.getElementById('scavenged-weapons-results');
    if (!container) return;

    const { rolls, total, result, error } = scenario_MeatForTheGrinderEngine.roll();

    if (typeof TimerUtil !== 'undefined') {
      const rollStrings = rolls ? [`2D6: ${rolls.join(' + ')} = ${total}`] : [];
      TimerUtil.markRun('scenario_MeatForTheGrinderLastRun', rollStrings);
    }

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
        <div class="result-heading result-name"><b>${result.name}</b></div>
        ${effectHtml}
      </div>
    `;

    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};