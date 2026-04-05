/**
 * postBattleUI.js — Front-end for the Post-Battle sequence page.
 *
 * Renders sections for each step a player might perform after a battle:
 *   - Succumb test (D6, triggers lasting injury on failure)
 *   - Lasting injury resolution (delegates to LastingInjuriesEngine)
 *   - Escape test with condition modifiers
 *   - Ransom — captured fighters suffer a lasting injury
 *   - Critical injury treatment (Rogue Doc with cost/refuse)
 *   - Chaos mutation test (identical panel to LastingInjuriesUI)
 *
 * Exposes `testInjury(roll)` to console for developer testing.
 *
 * Depends on: dice.js, icons.js, timer.js, postBattleEngine.js,
 *             lastingInjuriesEngine.js, injuryRenderer.js
 */

import { Icons } from './icons.js';
import { TimerUtil } from './timer.js';
import { PostBattleEngine } from './postBattleEngine.js';
import { LastingInjuriesEngine } from './lastingInjuriesEngine.js';
import { InjuryRenderer } from './injuryRenderer.js';
import { fetchJSON } from './dataLoader.js';

export const PostBattleUI = {

  async init(jsonPath) {
    try {
      const data = await fetchJSON(jsonPath);
      LastingInjuriesEngine.loadInjuries(data);

      this.bindEvents();
      this.initTimers();

      window.testInjury = (roll) => {
        const result = LastingInjuriesEngine.testRoll(roll);
        if (result) {
          this.displayInjuryResult(result, 'pb-injury-results');
          console.log('Test result for roll ' + roll + ':', result);
        }
      };

      console.log('%c💉 Injury Testing Enabled', 'color: #c71585; font-weight: bold; font-size: 14px;');
      console.log('Use: testInjury(roll) - e.g., testInjury(11) for D66 modes or testInjury(6) for Ironman mode');
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
      } else if (result.injury.randomeffect === 'd3multipleglitches') {
        rolls.push(`D3 glitches: ${result.randomRoll.value}`);
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
    const gangSelector = document.getElementById('pb-rogue-doc-gang');
    const gangId = gangSelector?.checked ? 'genestealer_cult' : null;

    const modeData = LastingInjuriesEngine.injuriesData?.[mode];
    if (modeData?.cost) {
      this.showCriticalInjuryCost(mode, gangId);
    } else {
      const result = LastingInjuriesEngine.resolveRogueDoc(mode);
      this.displayCriticalRogueDocResult(result);
    }
  },

  showCriticalInjuryCost(mode, gangId = null) {
    const costResult = LastingInjuriesEngine.calculateRogueDocCost(mode, gangId);
    const container = document.getElementById('pb-critical-injury-results');
    if (!container) return;

    container.innerHTML = '';

    if (costResult === null) {
      container.innerHTML = '<div class="error-box">Error: Injury data not loaded. Please refresh the page.</div>';
      return;
    }

    const { total: cost, rolls, costConfig } = costResult;
    const rollLabel = `${costConfig.count}D${costConfig.sides}: [${rolls.join(', ')}]`;

    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.recordRolls('postBattleLastRun', ['[Critical Injury]', `Cost: ${cost} credits (${rollLabel})`]);
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
      result.costRolls = rolls;
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
    InjuryRenderer.renderRogueDocResult(result, container);
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.recordRolls('postBattleLastRun', this.buildCriticalRogueDocRolls(result));
    }
  },

  buildCriticalRogueDocRolls(result) {
    const rolls = ['[Critical Injury]'];
    if (result.cost !== null && result.cost !== undefined) {
      const costRollStr = result.costRolls ? ` (${result.costRolls.length}D6: [${result.costRolls.join(', ')}])` : '';
      rolls.push(`Cost: ${result.cost} credits${costRollStr}`);
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
    const isGlitchMode = ['spyrer_hunting_rig_glitches', 'spyrer_hunting_rig_glitches_core'].includes(LastingInjuriesEngine.currentMode);
    const nameText = colour === 'black' ? `${Icons.skull} ${result.injury.name} ${Icons.skull}` : result.injury.name;
    const box = document.createElement('div');
    box.className = `result-box result-box-${colour} result-box-primary mt-20`;
    box.innerHTML = [
      `<h3 class="result-heading mt-0 mb-0">${nameText}</h3>`,
      result.injury.fixedeffect ? `<div class="result-effect mt-10">${result.injury.fixedeffect}</div>` : '',
      result.randomRoll && result.injury.randomeffect === 'd3xpgain'
        ? `<div class="mt-15">Gain ${result.randomRoll.value} XP!</div>` : '',
    ].filter(Boolean).join('');
    container.appendChild(box);
    InjuryRenderer.appendInjuryResultContent(result, box, container, { isGlitchMode });
  },

};
