// postBattleUI.js
// Depends on: injuryRenderer.js (InjuryRenderer)

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

    // Critical injury treatment button
    const criticalBtn = document.getElementById('pb-resolve-critical-injury');
    if (criticalBtn) {
      criticalBtn.addEventListener('click', () => this.onResolveCriticalInjury());
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
    TimerUtil.init('page-roll-info', 'postBattleLastRun');
    TimerUtil.setupPageCleanup();
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
      const timerRolls = [`[Escape] D6: ${roll}`, `Mod: ${modStr}`, `Total: ${total}`];
      if (natural6) timerRolls.push('Natural 6!');
      TimerUtil.markRun('postBattleLastRun', timerRolls);
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
      TimerUtil.markRun('postBattleLastRun', [`[Succumb] D6: ${roll}`]);
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

    // Show/hide the Resolve Lasting Injury button
    if (resolveBtn) {
      resolveBtn.style.display = succumbed ? '' : 'none';
    }
  },

  onResolveInjury() {
    const result = LastingInjuriesEngine.resolveInjury();

    if (typeof TimerUtil !== 'undefined' && result) {
      const modeData = LastingInjuriesEngine.getCurrentModeData();
      const sides = modeData && modeData.sides;
      const diceLabel = sides === 'd66' ? 'D66' : `D${sides}`;
      TimerUtil.markRun('postBattleLastRun', this.buildInjuryRolls(result, diceLabel, '[Lasting Injury]'));
    }

    this.displayInjuryResult(result, 'pb-injury-results');
  },

  onResolveRansomInjury() {
    const result = LastingInjuriesEngine.resolveInjury();

    if (typeof TimerUtil !== 'undefined' && result) {
      const modeData = LastingInjuriesEngine.getCurrentModeData();
      const sides = modeData && modeData.sides;
      const diceLabel = sides === 'd66' ? 'D66' : `D${sides}`;
      TimerUtil.markRun('postBattleLastRun', this.buildInjuryRolls(result, diceLabel, '[Ransom]'));
    }

    this.displayInjuryResult(result, 'pb-ransom-injury-results');
  },

  buildInjuryRolls(result, diceLabel, prefix = '') {
    const firstRoll = prefix ? `${prefix} ${diceLabel}: ${result.roll}` : `${diceLabel}: ${result.roll}`;
    const rolls = [firstRoll];

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

  onResolveCriticalInjury() {
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('postBattleLastRun', ['[Critical Injury]']);
    }

    const modeSelector = document.getElementById('pb-rogue-doc-mode');
    const mode = modeSelector ? modeSelector.value : 'trading_post_rogue_doc';

    if (mode === 'trading_post_rogue_doc') {
      this.showCriticalInjuryCost(mode);
    } else {
      const result = LastingInjuriesEngine.resolveRogueDoc(mode);
      this.displayCriticalRogueDocResult(result);
    }
  },

  showCriticalInjuryCost(mode) {
    const cost = LastingInjuriesEngine.calculateRogueDocCost(mode);
    const container = document.getElementById('pb-critical-injury-results');
    if (!container) return;

    container.innerHTML = '';

    if (cost === null) {
      container.innerHTML = '<div class="error-box">Error: Injury data not loaded. Please refresh the page.</div>';
      return;
    }

    container.innerHTML = `
      <div class="cost-box">
        <h2>Treatment Cost</h2>
        <h1>${cost} credits</h1>
        <p class="text-base mb-20">Do you want to proceed with treatment?</p>
        <div class="flex-center">
          <button id="pb-proceed-critical-treatment" class="btn btn-success">Proceed with Treatment</button>
          <button id="pb-refuse-critical-treatment" class="btn btn-danger">Refuse Treatment</button>
        </div>
      </div>
    `;

    container.querySelector('#pb-proceed-critical-treatment').addEventListener('click', () => {
      const result = LastingInjuriesEngine.resolveRogueDoc(mode, cost);
      this.displayCriticalRogueDocResult(result);
    });
    container.querySelector('#pb-refuse-critical-treatment').addEventListener('click', () => {
      this.displayCriticalFighterDeath();
    });
  },

  displayCriticalFighterDeath() {
    const container = document.getElementById('pb-critical-injury-results');
    if (!container) return;

    container.innerHTML = `
      <div class="death-box">
        <h2 class="mt-0">${Icons.skull} Fighter Dies ${Icons.skull}</h2>
        <p class="text-base mb-0">Without medical treatment, the fighter succumbs to their injuries and dies.<br><br>You recover their equipment.</p>
      </div>
    `;
  },

  displayCriticalRogueDocResult(result) {
    const container = document.getElementById('pb-critical-injury-results');
    if (!container) return;

    const colour = result.outcome.colour || 'grey';
    const resultDiv = document.createElement('div');
    resultDiv.className = `result-box result-box-${colour} result-box-primary mt-20`;
    resultDiv.innerHTML = [
      `<h2 class="result-heading text-capitalize mt-0">${result.outcome.name}</h2>`,
      result.outcome.fixedeffect ? `<div class="result-effect mt-10">${result.outcome.fixedeffect}</div>` : ''
    ].filter(Boolean).join('');

    if (result.outcome.randomeffect === 'stabilisedinjury' && result.stabilisedInjury) {
      const injuryContainer = document.createElement('div');
      injuryContainer.className = 'additional-injuries-container';
      const injColour = result.stabilisedInjury.injury.colour || 'grey';
      injuryContainer.appendChild(
        InjuryRenderer.createInjuryBox(result.stabilisedInjury.injury, injColour, null, result.stabilisedInjury.randomRoll)
      );
      resultDiv.appendChild(injuryContainer);

      InjuryRenderer.displayAdditionalInjuries(
        result.stabilisedInjury.additionalInjuries,
        resultDiv,
        'D66'
      );
    }

    container.innerHTML = '';
    container.appendChild(resultDiv);

    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.recordRolls('postBattleLastRun', this.buildCriticalRogueDocRolls(result));
    }
  },

  buildCriticalRogueDocRolls(result) {
    const rolls = ['[Critical Injury]'];
    if (result.cost !== null && result.cost !== undefined) {
      rolls.push(`Cost: ${result.cost} credits`);
    }
    rolls.push(`D6: ${result.roll}`);
    if (result.stabilisedInjury) {
      rolls.push(`Stabilised D66: ${result.stabilisedInjury.roll}`);
      if (result.stabilisedInjury.randomRoll) {
        rolls.push(`${result.stabilisedInjury.randomRoll.type.toUpperCase()}: ${result.stabilisedInjury.randomRoll.value}`);
      }
      if (result.stabilisedInjury.additionalInjuries) {
        result.stabilisedInjury.additionalInjuries.forEach((inj, i) => {
          rolls.push(`Stabilised Additional ${i + 1}: ${inj.roll}`);
        });
      }
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
    const nameText = colour === 'black'
      ? `${Icons.skull} ${result.injury.name} ${Icons.skull}`
      : result.injury.name;

    const box = document.createElement('div');
    box.className = `result-box result-box-${colour} result-box-primary mt-20`;
    box.style.animationDelay = '0ms';
    box.innerHTML = [
      `<h3 class="result-heading mt-0 mb-0">${nameText}</h3>`,
      result.injury.fixedeffect ? `<div class="result-effect mt-10">${result.injury.fixedeffect}</div>` : '',
      result.randomRoll && result.injury.randomeffect === 'd3xpgain'
        ? `<div class="mt-15">Gain ${result.randomRoll.value} XP!</div>` : '',
    ].filter(Boolean).join('');

    InjuryRenderer.displayAdditionalInjuries(result.additionalInjuries, box, 'Roll');
    InjuryRenderer.appendStatusWarnings(result.injury, box);

    container.appendChild(box);
  },

};
