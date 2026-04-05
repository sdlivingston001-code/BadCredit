/**
 * lastingInjuriesUI.js — Front-end for the Lasting Injuries tool.
 *
 * Renders:
 *   - Mode selector (standard / core / ironman / spyrer glitch variants)
 *   - "Roll Injury" button with animated result boxes
 *   - Collapsible injury reference table + mutation reference table
 *
 * Exposes `testInjury(roll)` to the console for developer testing.
 *
 * Depends on: dice.js, icons.js, timer.js, lastingInjuriesEngine.js,
 *             injuryRenderer.js
 */

import { Icons } from './icons.js';
import { TimerUtil } from './timer.js';
import { LastingInjuriesEngine } from './lastingInjuriesEngine.js';
import { InjuryRenderer } from './injuryRenderer.js';
import { fetchJSON } from './dataLoader.js';

export const LastingInjuriesUI = {
  injuriesData: null,

  async init(jsonPath) {
    try {
      this.injuriesData = await fetchJSON(jsonPath);
      LastingInjuriesEngine.loadInjuries(this.injuriesData);

      this.bindEvents();
      this.initTimers();
      this.renderInjuryTable();

      // Expose test function to window for console testing
      window.testInjury = (roll) => {
        const result = LastingInjuriesEngine.testRoll(roll);
        if (result) {
          this.displayResult(result);
          console.log('Test result for roll ' + roll + ':', result);
        }
      };

      console.log('%c💉 Injury Testing Enabled', 'color: #c71585; font-weight: bold; font-size: 14px;');
      console.log('Use: testInjury(roll) - e.g., testInjury(11) for Standard mode or testInjury(6) for Ironman mode');
    } catch (err) {
      console.error(err);
      const container = document.getElementById("lasting-injuries-results");
      if (container) {
        container.innerHTML = `<div class="error-box">
          <b>Error loading lasting injuries data:</b><br>
          ${err.message}
        </div>`;
      }
    }
  },

  bindEvents() {
    // Mode selector change event
    const modeSelector = document.getElementById("injury-mode-selector");
    if (modeSelector) {
      modeSelector.addEventListener("change", (e) => {
        this.changeMode(e.target.value);
      });
    }

    // Resolve button event
    const button = document.getElementById("resolve-lasting-injuries");
    if (button) {
      button.addEventListener("click", () => {
        this.resolveInjury();
      });
    }

  },

  initTimers() {
    const timerContainer = document.getElementById("page-roll-info");
    if (timerContainer && typeof TimerUtil !== 'undefined') {
      TimerUtil.init('page-roll-info', 'lastingInjuriesLastRun');
    }

    // Setup page cleanup to reset timers on navigation
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.setupPageCleanup();
    }
  },

  changeMode(mode) {
    LastingInjuriesEngine.setMode(mode);
    // Clear previous results when switching modes
    const resultsContainer = document.getElementById("lasting-injuries-results");
    if (resultsContainer) {
      resultsContainer.innerHTML = "";
    }
    this.renderInjuryTable();
  },

  renderInjuryTable() {
    const container = document.getElementById('injury-table-container');
    if (!container || !LastingInjuriesEngine.injuriesData) return;

    const modeData = LastingInjuriesEngine.getCurrentModeData();
    if (!modeData) return;

    const dieLabel = modeData.sides === 'd66' ? 'D66' : `D${modeData.sides}`;
    const injuries = Object.values(modeData.results);

    // Show status column only if any injury uses convalescence or intoRecovery
    const showStatus = injuries.some(i => i.convalescence === 1 || i.intoRecovery === 1);
    // Show glitch column only if any injury has glitch: 1
    const showGlitch = injuries.some(i => i.glitch === 1);

    const rows = injuries.map(injury => {
      const colour = injury.colour || 'grey';
      const rollStr = injury.values.join(', ');
      const effect = [injury.fixedeffect, InjuryRenderer.formatRandomEffectLabel(injury.randomeffect)].filter(Boolean).join('<br>');
      const statusCell = showStatus ? `<td>${[
        injury.convalescence === 1 ? `<span class="warning-box" style="display:inline-block;margin:2px 0;white-space:nowrap;">${Icons.warning} Convalescence</span>` : '',
        injury.intoRecovery === 1 ? `<span class="recovery-box" style="display:inline-block;margin:2px 0;white-space:nowrap;">${Icons.hospital} Into Recovery</span>` : ''
      ].filter(Boolean).join('<br>') || '&mdash;'}</td>` : '';
      const glitchCell = showGlitch ? `<td>${injury.glitch === 1 ? `<span class="glitch-tag" style="display:inline-block;margin:2px 0;white-space:nowrap;">${Icons.zap} Glitch</span>` : '&mdash;'}</td>` : '';
      return `<tr class="row-${colour}">
        <td>${rollStr}</td>
        <td><b>${injury.name}</b></td>
        <td>${effect || '&mdash;'}</td>
        ${statusCell}${glitchCell}
      </tr>`;
    }).join('');

    const statusHeader = showStatus ? '<th>Status</th>' : '';
    const glitchHeader = showGlitch ? '<th>Glitch</th>' : '';

    container.innerHTML = `
      <h3>Injury Table (${dieLabel})</h3>
      <table>
        <thead><tr><th>Roll</th><th>Result</th><th>Effect</th>${statusHeader}${glitchHeader}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    this.renderMutationTable(container);
  },

  renderMutationTable(container) {
    const mode = LastingInjuriesEngine.currentMode;
    if (mode === 'spyrer_hunting_rig_glitches' || mode === 'spyrer_hunting_rig_glitches_core' || mode === 'ironman_lasting_injuries') return;

    const mutData = LastingInjuriesEngine.injuriesData?.mutation_exceptions;
    if (!mutData || !mutData.mutations) return;

    const injuries = Object.entries(mutData.mutations);
    if (injuries.length === 0) return;

    // Build a lookup of injury name from the current mode's results
    const allResults = {};
    Object.values(LastingInjuriesEngine.injuriesData).forEach(section => {
      if (section && section.results) {
        Object.entries(section.results).forEach(([id, data]) => {
          allResults[id] = data.name;
        });
      }
    });

    const modifiers = (mutData.test?.modifiers || []).map(m => `+${m.value} ${m.label}`).join('<br>');

    const rows = injuries.map(([injuryId, mutation]) => {
      const injuryName = allResults[injuryId] || injuryId;
      return `<tr class="row-purple">
        <td><b>${injuryName}</b></td>
        <td><b>${mutation.name}</b></td>
        <td>${mutation.fixedeffect}</td>
      </tr>`;
    }).join('');

    const modifiersHtml = modifiers ? `<p class="text-base mt-10 mb-10"><b>D6 Modifiers:</b><br>${modifiers}</p>` : '';

    const section = document.createElement('div');
    section.className = 'mt-20';
    section.innerHTML = `
      <h3>Chaos Mutations</h3>
      <p class="text-base mt-0 mb-0">If the fighter belongs to a <b>Helot Chaos Cult</b>, <b>Corpse Grinder Cult</b> or <b>Chaos Corrupted</b> gang and suffers one of the injuries below, roll a D6. On a 6+ the injury becomes a mutation instead.</p>
      ${modifiersHtml}
      <table>
        <thead><tr><th>Lasting Injury</th><th>Mutation</th><th>Effect</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    container.appendChild(section);
  },

  collectInjuryRolls(result) {
    if (!result || result.roll === 'Error') return [];
    const modeData = LastingInjuriesEngine.getCurrentModeData();
    const dieLabel = modeData && modeData.sides === 'd66' ? 'D66' : `D${modeData && modeData.sides || 6}`;
    const rolls = [`${dieLabel}: ${result.roll}`];
    if (result.randomRoll) {
      rolls.push(`${result.randomRoll.type.toUpperCase()}: ${result.randomRoll.value}`);
    }
    if (result.additionalInjuries) {
      result.additionalInjuries.forEach((inj, i) => {
        rolls.push(`Additional ${i + 1}: ${inj.roll}`);
        if (inj.randomRoll) {
          rolls.push(`Additional ${i + 1} ${inj.randomRoll.type.toUpperCase()}: ${inj.randomRoll.value}`);
        }
      });
    }
    return rolls;
  },

  resolveInjury() {
    const result = LastingInjuriesEngine.resolveInjury();
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('lastingInjuriesLastRun', this.collectInjuryRolls(result));
      TimerUtil.showTimer('page-roll-info');
    }

    this.displayResult(result);
  },

  displayResult(result) {
    const resultsContainer = document.getElementById("lasting-injuries-results");
    if (!resultsContainer) return;

    const colour = result.injury.colour || "grey";
    const isGlitchMode = ['spyrer_hunting_rig_glitches', 'spyrer_hunting_rig_glitches_core'].includes(LastingInjuriesEngine.currentMode);
    const nameText = colour === 'black' ? `${Icons.skull} ${result.injury.name} ${Icons.skull}` : result.injury.name;

    const resultDiv = document.createElement("div");
    resultDiv.className = `result-box result-box-${colour} result-box-primary mt-20`;
    resultDiv.innerHTML = [
      `<h3 class="result-heading mt-0 mb-0">${nameText}</h3>`,
      result.injury.fixedeffect ? `<div class="result-effect mt-10">${result.injury.fixedeffect}</div>` : '',
      result.injury.randomeffect && !['d3multipleinjuries', 'd3multipleglitches'].includes(result.injury.randomeffect) && result.randomRoll
        ? `<div class="mt-15">${InjuryRenderer.formatRandomEffect(result.injury.randomeffect, result.randomRoll)}</div>` : '',
    ].filter(Boolean).join('');

    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(resultDiv);
    InjuryRenderer.appendInjuryResultContent(result, resultDiv, resultsContainer, { isGlitchMode });
  },

};
