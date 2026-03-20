// postBattleUI.js

const PostBattleUI = {

  async init(jsonPath) {
    try {
      const response = await fetch(`${jsonPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load lasting injuries data: ${response.status}`);

      const data = await response.json();
      LastingInjuriesEngine.loadInjuries(data);

      this.bindEvents();
      this.initTimers();
    } catch (err) {
      console.error(err);
    }
  },

  bindEvents() {
    // Mode selector → update LastingInjuriesEngine
    const modeSelector = document.getElementById('pb-injury-mode');
    if (modeSelector) {
      modeSelector.addEventListener('change', (e) => {
        LastingInjuriesEngine.setMode(e.target.value);
      });
    }

    // Roll D6 to Succumb button
    const rollBtn = document.getElementById('pb-roll-succumb');
    if (rollBtn) {
      rollBtn.addEventListener('click', () => this.onRollSuccumb());
    }

    // Resolve Lasting Injury button
    const resolveBtn = document.getElementById('pb-resolve-injury');
    if (resolveBtn) {
      resolveBtn.addEventListener('click', () => this.onResolveInjury());
    }

    // Roll to Escape button
    const escapeBtn = document.getElementById('pb-roll-escape');
    if (escapeBtn) {
      escapeBtn.addEventListener('click', () => this.onRollEscape());
    }

    // Ransom lasting injury button (always visible)
    const ransomBtn = document.getElementById('pb-resolve-ransom-injury');
    if (ransomBtn) {
      ransomBtn.addEventListener('click', () => this.onResolveRansomInjury());
    }

    // Draw / Lost are mutually exclusive
    const drawBox = document.getElementById('pb-cap-draw');
    const lostBox = document.getElementById('pb-cap-lost');
    if (drawBox && lostBox) {
      drawBox.addEventListener('change', () => { if (drawBox.checked) lostBox.checked = false; });
      lostBox.addEventListener('change', () => { if (lostBox.checked) drawBox.checked = false; });
    }
  },

  initTimers() {
    if (typeof TimerUtil === 'undefined') return;

    // Timer for the Roll D6 to Succumb button
    const rollBtn = document.getElementById('pb-roll-succumb');
    if (rollBtn) {
      const timerDiv = document.createElement('div');
      timerDiv.id = 'pb-succumb-timer';
      timerDiv.className = 'mt-15';
      rollBtn.parentNode.insertBefore(timerDiv, rollBtn.nextSibling);
      TimerUtil.init('pb-succumb-timer', 'pbSuccumbLastRun');
    }

    // Timer for the Resolve Lasting Injury button
    const resolveBtn = document.getElementById('pb-resolve-injury');
    if (resolveBtn) {
      const timerDiv = document.createElement('div');
      timerDiv.id = 'pb-injury-timer';
      timerDiv.className = 'mt-15';
      timerDiv.style.display = 'none';
      resolveBtn.parentNode.insertBefore(timerDiv, resolveBtn.nextSibling);
      TimerUtil.init('pb-injury-timer', 'pbInjuryLastRun');
    }

    TimerUtil.setupPageCleanup();

    // Timer for the Roll to Escape button
    const escapeBtn = document.getElementById('pb-roll-escape');
    if (escapeBtn) {
      TimerUtil.init('pb-escape-timer', 'pbEscapeLastRun');
    }

    // Timer for the Ransom lasting injury button
    const ransomBtn = document.getElementById('pb-resolve-ransom-injury');
    if (ransomBtn) {
      const timerDiv = document.createElement('div');
      timerDiv.id = 'pb-ransom-injury-timer';
      timerDiv.className = 'mt-15';
      ransomBtn.parentNode.insertBefore(timerDiv, ransomBtn.nextSibling);
      TimerUtil.init('pb-ransom-injury-timer', 'pbRansomInjuryLastRun');
    }
  },

  onRollEscape() {
    const draw      = document.getElementById('pb-cap-draw')?.checked     ? -1 : 0;
    const lost      = document.getElementById('pb-cap-lost')?.checked     ? -2 : 0;
    const webbed    = document.getElementById('pb-cap-webbed')?.checked   ? -2 : 0;
    const skinblade = document.getElementById('pb-cap-skinblade')?.checked ?  2 : 0;
    const modifier  = draw + lost + webbed + skinblade;

    const { roll, total, natural6, escaped } = PostBattleEngine.rollEscape(modifier);

    if (typeof TimerUtil !== 'undefined') {
      const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
      const timerRolls = [`D6: ${roll}`, `Mod: ${modStr}`, `Total: ${total}`];
      if (natural6) timerRolls.push('Natural 6!');
      TimerUtil.markRun('pbEscapeLastRun', timerRolls);
    }

    const container = document.getElementById('pb-escape-results');
    if (!container) return;

    let colour, heading;

    if (natural6) {
      colour  = 'green';
      heading = 'Natural 6 — Fighter Escapes!';
    } else if (escaped) {
      colour  = 'green';
      heading = '4+ Fighter Escapes!';
    } else {
      colour  = 'red';
      heading = '3- Fighter is Captured';
    }

    container.innerHTML = `
      <div class="result-box result-box-${colour} result-box-primary mt-20">
        <h3 class="result-heading mt-0 mb-0">${heading}</h3>
      </div>`;
  },

  onRollSuccumb() {
    const { roll, succumbed } = PostBattleEngine.rollSuccumb();

    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('pbSuccumbLastRun', [`D6: ${roll}`]);
    }

    const succumbResults = document.getElementById('pb-succumb-results');
    const resolveBtn = document.getElementById('pb-resolve-injury');
    const injuryResults = document.getElementById('pb-injury-results');

    // Clear previous injury result whenever we re-roll succumb
    if (injuryResults) injuryResults.innerHTML = '';

    if (succumbResults) {
      const colour = succumbed ? 'red' : 'green';
      const label = succumbed
        ? `2- Suffer a Lasting Injury!`
        : `3+ Okay, no lasting injury.`;
      succumbResults.innerHTML = `<div class="result-box result-box-${colour}">${label}</div>`;
    }

    // Show/hide the Resolve Lasting Injury button and its timer
    if (resolveBtn) {
      resolveBtn.style.display = succumbed ? '' : 'none';
    }
    const injuryTimer = document.getElementById('pb-injury-timer');
    if (injuryTimer) {
      injuryTimer.style.display = succumbed ? '' : 'none';
    }
  },

  onResolveInjury() {
    const result = LastingInjuriesEngine.resolveInjury();

    if (typeof TimerUtil !== 'undefined' && result) {
      const modeData = LastingInjuriesEngine.getCurrentModeData();
      const sides = modeData && modeData.sides;
      const diceLabel = sides === 'd66' ? 'D66' : `D${sides}`;
      TimerUtil.markRun('pbInjuryLastRun', this.buildInjuryRolls(result, diceLabel));
    }

    this.displayInjuryResult(result, 'pb-injury-results');
  },

  onResolveRansomInjury() {
    const result = LastingInjuriesEngine.resolveInjury();

    if (typeof TimerUtil !== 'undefined' && result) {
      const modeData = LastingInjuriesEngine.getCurrentModeData();
      const sides = modeData && modeData.sides;
      const diceLabel = sides === 'd66' ? 'D66' : `D${sides}`;
      TimerUtil.markRun('pbRansomInjuryLastRun', this.buildInjuryRolls(result, diceLabel));
    }

    this.displayInjuryResult(result, 'pb-ransom-injury-results');
  },

  buildInjuryRolls(result, diceLabel) {
    const rolls = [`${diceLabel}: ${result.roll}`];

    if (result.randomRoll) {
      if (result.injury.randomeffect === 'd3xpgain') {
        rolls.push(`D3 XP: ${result.randomRoll.value}`);
      } else if (result.injury.randomeffect === 'd3multipleinjuries') {
        rolls.push(`D3 injuries: ${result.randomRoll.value}`);
      }
    }

    if (result.additionalInjuries && result.additionalInjuries.length > 0) {
      result.additionalInjuries.forEach((injResult, i) => {
        rolls.push(`${diceLabel} #${i + 1}: ${injResult.roll}`);
        if (injResult.randomRoll && injResult.injury.randomeffect === 'd3xpgain') {
          rolls.push(`D3 XP: ${injResult.randomRoll.value}`);
        }
      });
    }

    return rolls;
  },

  displayInjuryResult(result, containerId = 'pb-injury-results') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!result || !result.injury) {
      container.innerHTML = '<div class="error-box">Failed to resolve injury.</div>';
      return;
    }

    const colour = result.injury.colour || 'grey';

    const box = document.createElement('div');
    box.className = `result-box result-box-${colour} result-box-primary mt-20`;
    box.innerHTML = [
      `<h3 class="result-heading mt-0 mb-0">${result.injury.name}</h3>`,
      result.injury.fixedeffect ? `<div class="result-effect mt-10">${result.injury.fixedeffect}</div>` : '',
      result.randomRoll && result.injury.randomeffect === 'd3xpgain'
        ? `<div class="mt-15">Gain ${result.randomRoll.value} XP!</div>` : '',
    ].filter(Boolean).join('');

    container.appendChild(box);

    // Additional injuries from d3multipleinjuries
    if (result.additionalInjuries && result.additionalInjuries.length > 0) {
      const additionalContainer = document.createElement('div');
      additionalContainer.className = 'additional-injuries-container';

      let hasConvalescence = false;
      let hasRecovery = false;

      result.additionalInjuries.forEach((injResult, index) => {
        const injColour = injResult.injury.colour || 'grey';
        const injBox = document.createElement('div');
        injBox.className = `result-box result-box-${injColour}${index > 0 ? ' mt-10' : ''}`;
        injBox.innerHTML = [
          `<div class="result-heading result-name"><b>${injResult.injury.name}</b></div>`,
          injResult.injury.fixedeffect ? `<div class="result-effect">${injResult.injury.fixedeffect}</div>` : '',
        ].filter(Boolean).join('');
        additionalContainer.appendChild(injBox);

        if (injResult.injury.convalescence === 1) hasConvalescence = true;
        if (injResult.injury.intoRecovery === 1) hasRecovery = true;
      });

      if (hasConvalescence) {
        const warn = document.createElement('div');
        warn.className = 'warning-box';
        warn.innerHTML = '⚠️ <b>Convalescence:</b> This fighter cannot participate in the next battle (but can still take Post Battle actions).';
        additionalContainer.appendChild(warn);
      }
      if (hasRecovery) {
        const warn = document.createElement('div');
        warn.className = 'recovery-box';
        warn.innerHTML = '🏥 <b>Into Recovery:</b> This fighter goes into recovery. They cannot make Post Battle actions AND they miss the next battle.';
        additionalContainer.appendChild(warn);
      }

      container.appendChild(additionalContainer);
    }
  },

};
