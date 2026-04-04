/**
 * injuryRenderer.js — Shared injury display components.
 *
 * Provides reusable DOM-building helpers for rendering injury results,
 * status warnings (Convalescence / Into Recovery), and cascading
 * additional-injury panels.
 *
 * Used by both LastingInjuriesUI (standalone injuries page) and
 * PostBattleUI (post-battle sequence page) to keep rendering logic
 * consistent across all places where injury results are shown.
 *
 * Depends on: icons.js (Icons.warning, Icons.hospital)
 */

import { Icons } from './icons.js';
import { LastingInjuriesEngine } from './lastingInjuriesEngine.js';

export const InjuryRenderer = {

  /** Static warning messages used for convalescence / recovery badges. */

  MESSAGES: {
    convalescence: "This fighter cannot make <b>Post Battle Actions</b> (but are available for the next battle as normal).",
    recovery: "This fighter goes <b>into recovery</b>. They cannot make Post Battle Actions AND they miss the next battle."
  },

  /**
   * Create a styled warning box for convalescence or recovery.
   * @param {'convalescence'|'recovery'} type
   * @param {string} message - HTML text to display.
   * @returns {HTMLDivElement}
   */
  createWarningBox(type, message) {
    const configs = {
      convalescence: { className: "warning-box", icon: Icons.warning, label: "Convalescence" },
      recovery:      { className: "recovery-box", icon: Icons.hospital, label: "Into Recovery" }
    };
    const config = configs[type];
    const div = document.createElement("div");
    div.className = config.className;
    div.innerHTML = `${config.icon} <b>${config.label}:</b> ${message}`;
    return div;
  },

  /**
   * Appends convalescence / recovery warning boxes to a parent element
   * when the injury has the corresponding flag set.
   * @param {Object}      injury   - Injury data object from the engine.
   * @param {HTMLElement}  parentEl - DOM node to append warnings to.
   */
  appendStatusWarnings(injury, parentEl) {
    if (injury.convalescence === 1) {
      parentEl.appendChild(this.createWarningBox("convalescence", this.MESSAGES.convalescence));
    }
    if (injury.intoRecovery === 1) {
      parentEl.appendChild(this.createWarningBox("recovery", this.MESSAGES.recovery));
    }
  },

  /**
   * Format a random-effect value for inline display (e.g. "Gain 2 XP!").
   * @param {string|null} randomeffect - Effect key from injury data.
   * @param {{ type: string, value: number }|null} randomRoll - Roll result.
   * @returns {string}
   */
  formatRandomEffect(randomeffect, randomRoll) {
    if (!randomRoll) return randomeffect;
    if (randomeffect === 'd3xpgain') return `Gain ${randomRoll.value} XP!`;
    return randomeffect;
  },

  /**
   * Return a human-readable label for reference-table display.
   * @param {string|null} randomeffect
   * @returns {string|null}
   */
  formatRandomEffectLabel(randomeffect) {
    if (!randomeffect) return null;
    if (randomeffect === 'd3xpgain') return 'Gain D3 XP.';
    if (randomeffect === 'd3multipleinjuries') return 'Suffer D3 Lasting Injuries (ignoring Captured, Multiple Injuries, Memorable Death, Critical Injury, or Out Cold).';
    if (randomeffect === 'd3multipleglitches') return 'Suffer D3 Hunting Rig glitches (ignoring Multiple Glitches).';
    if (randomeffect === 'stabilisedinjury') return 'Roll a Lasting Injury on the selected table.';
    return randomeffect;
  },

  /**
   * Create a colour-coded result box for a single injury.
   * @param {Object}      injury     - Injury data with name, fixedeffect, randomeffect.
   * @param {string}      colour     - CSS colour key (green/blue/yellow/red/purple/grey/black).
   * @param {string|null} [rollInfo]  - Optional HTML showing the dice roll.
   * @param {Object|null} [randomRoll] - Optional random sub-roll result.
   * @returns {HTMLDivElement}
   */
  createInjuryBox(injury, colour, rollInfo = null, randomRoll = null) {
    const injDiv = document.createElement("div");
    injDiv.className = `result-box result-box-${colour || 'grey'}`;
    injDiv.innerHTML = [
      `<div class="result-heading result-name"><b>${injury.name}</b></div>`,
      injury.fixedeffect ? `<div class="result-effect">${injury.fixedeffect}</div>` : '',
      injury.randomeffect && injury.randomeffect !== 'd3multipleinjuries' && randomRoll
        ? `<div class="result-effect mt-10">${this.formatRandomEffect(injury.randomeffect, randomRoll)}</div>` : '',
    ].filter(Boolean).join('');
    return injDiv;
  },

  /**
   * Render a list of cascading additional injuries (e.g. from "D3 Multiple Injuries").
   * Each sub-injury gets a staggered pop-in animation delay.
   * @param {Object[]|null} injuries        - Array of { injury, roll, randomRoll } objects.
   * @param {HTMLElement}    parentDiv       - DOM node to append the sub-injuries to.
   * @param {string}         [rollLabelFormat='Roll'] - Prefix for roll labels.
   */
  displayAdditionalInjuries(injuries, parentDiv, rollLabelFormat = 'Roll') {
    if (!injuries || injuries.length === 0) return;

    const additionalContainer = document.createElement("div");
    additionalContainer.className = "additional-injuries-container";

    const additionalTitle = document.createElement("h4");
    additionalContainer.appendChild(additionalTitle);

    let hasConvalescence = false;
    let hasRecovery = false;

    injuries.forEach((injuryResult, index) => {
      const injColour = injuryResult.injury.colour || "grey";
      const rollLabel = rollLabelFormat === 'D66'
        ? `<b>D66 Roll:</b> ${injuryResult.roll}`
        : `<b>${rollLabelFormat} ${index + 1}:</b> ${injuryResult.roll}`;

      const injDiv = this.createInjuryBox(injuryResult.injury, injColour, rollLabel, injuryResult.randomRoll);
      if (index > 0) injDiv.classList.add('mt-10');
      injDiv.style.animationDelay = `${(index + 1) * 180}ms`;
      additionalContainer.appendChild(injDiv);

      if (injuryResult.injury.convalescence === 1) hasConvalescence = true;
      if (injuryResult.injury.intoRecovery === 1) hasRecovery = true;
    });

    if (hasConvalescence) {
      additionalContainer.appendChild(this.createWarningBox("convalescence", this.MESSAGES.convalescence));
    }
    if (hasRecovery) {
      additionalContainer.appendChild(this.createWarningBox("recovery", this.MESSAGES.recovery));
    }

    parentDiv.appendChild(additionalContainer);
  },

  /**
   * Create a collapsible mutation-check button section for a single injury.
   * When clicked, expands into a D6 roll panel with modifier checkboxes.
   * @param {Object} injury - Injury data with id and name.
   * @returns {HTMLDivElement}
   */
  createMutationCheckSection(injury) {
    const section = document.createElement('div');
    section.className = 'mutation-check-section mt-20';

    const btn = document.createElement('button');
    btn.className = 'btn btn-chaos';
    btn.innerHTML = `Corpse Grinder Cult / Helot Chaos Cults / Chaos Corrupted:<br>Check for Mutation \u2014 ${injury.name}`;
    btn.addEventListener('click', () => {
      section.innerHTML = '';
      section.appendChild(this.buildMutationTestPanel(injury));
    });

    section.appendChild(btn);
    return section;
  },

  /**
   * Build the expanded mutation test panel (modifiers + D6 roll).
   * @param {Object} injury - Injury data with id and name.
   * @returns {HTMLDivElement}
   */
  buildMutationTestPanel(injury) {
    const modifiers = LastingInjuriesEngine.getMutationModifiers();
    const panel = document.createElement('div');
    panel.className = 'mutation-test-panel';

    const modifierItems = modifiers.map(mod => `
      <div class="territory-item">
        <label>
          <input type="checkbox" value="${mod.id}">
          +${mod.value} ${mod.label}
        </label>
      </div>`).join('');

    panel.innerHTML = `
      <h3 class="mt-0">Mutation Test <span class="text-muted text-small">(${injury.name})</span></h3>
      <p class="text-base">Roll a D6. On a <b>6+</b> the injury becomes a mutation instead.</p>
      <div class="mutation-modifiers mb-15">${modifierItems}</div>
      <button class="btn btn-chaos roll-mutation-btn">Roll D6</button>
      <div class="mutation-roll-result-container"></div>
    `;

    panel.querySelector('.roll-mutation-btn').addEventListener('click', () => {
      const checked = Array.from(panel.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
      const testResult = LastingInjuriesEngine.rollMutationTest(checked);
      const mutation = LastingInjuriesEngine.getMutation(injury.id);
      const resultContainer = panel.querySelector('.mutation-roll-result-container');

      const bonusText = testResult.bonus > 0 ? ` +${testResult.bonus}` : '';
      const totalText = testResult.bonus > 0 ? ` = ${testResult.total}` : '';

      if (testResult.success) {
        const mutBox = this.createInjuryBox(mutation, 'purple');
        resultContainer.innerHTML = `<div class="mutation-roll-result mutation-success">D6: ${testResult.roll}${bonusText}${totalText} &mdash; Mutation! Apply this instead:</div>`;
        resultContainer.appendChild(mutBox);

        const spawnNote = LastingInjuriesEngine.injuriesData?.mutation_exceptions?.chaos_spawn?.note;
        if (spawnNote) {
          const spawnDiv = document.createElement('div');
          spawnDiv.className = 'chaos-spawn-note mt-10';
          spawnDiv.innerHTML = `<b>Chaos Spawn:</b> ${spawnNote}`;
          resultContainer.appendChild(spawnDiv);
        }
      } else {
        resultContainer.innerHTML = `<div class="mutation-roll-result mutation-fail">D6: ${testResult.roll}${bonusText}${totalText} &mdash; No Mutation. Apply injury as normal.</div>`;
      }

      panel.querySelector('.roll-mutation-btn').disabled = true;
      panel.querySelectorAll('input[type=checkbox]').forEach(cb => cb.disabled = true);
    });

    return panel;
  }

};
