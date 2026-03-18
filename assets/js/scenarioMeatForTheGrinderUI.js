// scenarioMeatForTheGrinderUI.js

const scenarioMeatForTheGrinderUI = {
  async init(jsonPath) {
    try {
      const response = await fetch(`${jsonPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);

      const data = await response.json();
      scenarioMeatForTheGrinderEngine.loadData(data);
      this.bindEvents();
      this.initTimer();
      this.renderWeaponTable(data);
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
    const button = document.getElementById('roll-scavenged-weapon');
    if (button && typeof TimerUtil !== 'undefined') {
      const timerContainer = document.createElement('div');
      timerContainer.id = 'scavenged-weapons-timer';
      timerContainer.className = 'mt-15';
      button.parentNode.insertBefore(timerContainer, button.nextSibling);
      TimerUtil.init('scavenged-weapons-timer', 'scenarioMeatForTheGrinderLastRun');
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

    const { rolls, total, result, error } = scenarioMeatForTheGrinderEngine.roll();

    if (typeof TimerUtil !== 'undefined') {
      const rollStrings = rolls ? [`2D6: ${rolls.join(' + ')} = ${total}`] : [];
      TimerUtil.markRun('scenarioMeatForTheGrinderLastRun', rollStrings);
      TimerUtil.showTimer('scavenged-weapons-timer');
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
        <div class="result-heading result-roll"><b>2D6 Roll:</b> ${diceHtml}${total}</div>
        <div class="result-heading result-name"><b>${result.name}</b></div>
        ${effectHtml}
      </div>
    `;

    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};