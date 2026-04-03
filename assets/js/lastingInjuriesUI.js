// lastingInjuriesUI.js
// Depends on: injuryRenderer.js (InjuryRenderer)

const LastingInjuriesUI = {
  injuriesData: null,

  async init(jsonPath) {
    try {
      const response = await fetch(`${jsonPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load lasting injuries: ${response.status}`);
      }

      this.injuriesData = await response.json();
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

  resolveRogueDoc() {
    // Mark the run time and show this timer
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('rogueDocLastRun');
      TimerUtil.showTimer('rogue-doc-timer');
    }
    
    const modeSelector = document.getElementById("rogue-doc-mode-selector");
    const mode = modeSelector ? modeSelector.value : "trading_post_rogue_doc";
    
    // Clear lasting injuries results
    const injuryResults = document.getElementById("lasting-injuries-results");
    if (injuryResults) injuryResults.innerHTML = "";
    
    // For trading post, show cost first
    if (mode === "trading_post_rogue_doc") {
      this.showTradingPostCost(mode);
    } else {
      // For hanger-on, proceed directly
      const result = LastingInjuriesEngine.resolveRogueDoc(mode);
      this.displayRogueDocResult(result);
    }
  },

  showTradingPostCost(mode) {
    const cost = LastingInjuriesEngine.calculateRogueDocCost(mode);
    const resultsContainer = document.getElementById("rogue-doc-results");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";

    if (cost === null) {
      resultsContainer.innerHTML = '<div class="error-box">Error: Injury data not loaded. Please refresh the page.</div>';
      return;
    }

    resultsContainer.innerHTML = `
      <div class="cost-box">
        <h2>Treatment Cost</h2>
        <h1>${cost} credits</h1>
        <p class="text-base mb-20">Do you want to proceed with treatment?</p>
        <div class="flex-center">
          <button id="proceed-treatment" class="btn btn-success">Proceed with Treatment</button>
          <button id="refuse-treatment" class="btn btn-danger">Refuse Treatment</button>
        </div>
      </div>
    `;

    resultsContainer.querySelector('#proceed-treatment').addEventListener('click', () => {
      const result = LastingInjuriesEngine.resolveRogueDoc(mode, cost);
      this.displayRogueDocResult(result);
    });
    resultsContainer.querySelector('#refuse-treatment').addEventListener('click', () => {
      this.displayFighterDeath();
    });
  },

  displayFighterDeath() {
    const resultsContainer = document.getElementById("rogue-doc-results");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="death-box">
        <h2 class="mt-0">${Icons.skull} Fighter Dies ${Icons.skull}</h2>
        <p class="text-base mb-0">Without medical treatment, the fighter succumbs to their injuries and dies.<br><br>You recover their equipment.</p>
      </div>
    `;
  },

  displayRogueDocResult(result) {
    const resultsContainer = document.getElementById("rogue-doc-results");
    if (!resultsContainer) return;

    const colour = result.outcome.colour || "grey";
    const resultDiv = document.createElement("div");
    resultDiv.className = `result-box result-box-${colour} result-box-primary mt-20`;
    resultDiv.innerHTML = [
      `<h2 class="result-heading text-capitalize mt-0">${result.outcome.name}</h2>`,
      result.outcome.fixedeffect ? `<div class="result-effect mt-10">${result.outcome.fixedeffect}</div>` : ''
    ].filter(Boolean).join('');

    if (result.outcome.randomeffect === 'stabilisedinjury' && result.stabilisedInjury) {
      const injuryContainer = document.createElement("div");
      injuryContainer.className = "additional-injuries-container";

      const injColour = result.stabilisedInjury.injury.colour || "grey";
      injuryContainer.appendChild(InjuryRenderer.createInjuryBox(
        result.stabilisedInjury.injury,
        injColour,
        `<b>D66 Roll:</b> ${result.stabilisedInjury.roll}`,
        result.stabilisedInjury.randomRoll
      ));
      resultDiv.appendChild(injuryContainer);

      InjuryRenderer.displayAdditionalInjuries(
        result.stabilisedInjury.additionalInjuries,
        resultDiv,
        'D66'
      );
    }

    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(resultDiv);
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.recordRolls('rogueDocLastRun', this.collectRogueDocRolls(result));
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

  renderTreatmentTable() {
    const container = document.getElementById('treatment-table-container');
    if (!container || !LastingInjuriesEngine.injuriesData) return;

    const modeSelector = document.getElementById('rogue-doc-mode-selector');
    const mode = modeSelector ? modeSelector.value : 'trading_post_rogue_doc';
    const modeData = LastingInjuriesEngine.injuriesData[mode];
    if (!modeData) return;

    const dieLabel = `D${modeData.sides}`;
    const modeName = mode === 'trading_post_rogue_doc' ? 'Trading Post' : 'Hanger-on';

    let costHtml = '';
    if (modeData.cost) {
      const c = modeData.cost;
      costHtml = `<p><b>Cost:</b> ${c.count}D${c.sides}&times;${c.multiplier} credits</p>`;
    }

    const rows = Object.values(modeData.results).map(outcome => {
      const colour = outcome.colour || 'grey';
      const rollStr = outcome.values.join(', ');
      const effect = [outcome.fixedeffect, InjuryRenderer.formatRandomEffectLabel(outcome.randomeffect)].filter(Boolean).join('<br>');
      return `<tr class="row-${colour}">
        <td>${rollStr}</td>
        <td class="text-capitalize"><b>${outcome.name}</b></td>
        <td>${effect || '&mdash;'}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <h3>Treatment Table &mdash; ${modeName} (${dieLabel})</h3>
      ${costHtml}
      <table>
        <thead><tr><th>Roll</th><th>Result</th><th>Effect</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
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

  collectRogueDocRolls(result) {
    const rolls = [];
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
          if (inj.randomRoll) {
            rolls.push(`Stabilised Additional ${i + 1} ${inj.randomRoll.type.toUpperCase()}: ${inj.randomRoll.value}`);
          }
        });
      }
    }
    return rolls;
  },

  resolveInjury() {
    const result = LastingInjuriesEngine.resolveInjury();
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('lastingInjuriesLastRun', this.collectInjuryRolls(result));
      TimerUtil.showTimer('page-roll-info');
    }

    // Clear rogue doc results
    const rogueDocResults = document.getElementById("rogue-doc-results");
    if (rogueDocResults) rogueDocResults.innerHTML = "";

    this.displayResult(result);
  },

  displayResult(result) {
    const resultsContainer = document.getElementById("lasting-injuries-results");
    if (!resultsContainer) return;

    const colour = result.injury.colour || "grey";
    const nameText = colour === 'black' ? `${Icons.skull} ${result.injury.name} ${Icons.skull}` : result.injury.name;

    const resultDiv = document.createElement("div");
    resultDiv.className = `result-box result-box-${colour} result-box-primary mt-20`;
    resultDiv.innerHTML = [
      `<h3 class="result-heading mt-0 mb-0">${nameText}</h3>`,
      result.injury.fixedeffect ? `<div class="result-effect mt-10">${result.injury.fixedeffect}</div>` : '',
      result.injury.randomeffect && result.injury.randomeffect !== 'd3multipleinjuries' && result.injury.randomeffect !== 'd3multipleglitches' ? `<div class="mt-15">${InjuryRenderer.formatRandomEffect(result.injury.randomeffect, result.randomRoll)}</div>` : '',
    ].filter(Boolean).join('');

    const isGlitchMode = ['spyrer_hunting_rig_glitches', 'spyrer_hunting_rig_glitches_core'].includes(LastingInjuriesEngine.currentMode);
    const additionalLabel = isGlitchMode ? 'Glitch' : 'Roll';
    InjuryRenderer.displayAdditionalInjuries(result.additionalInjuries, resultDiv, additionalLabel);
    InjuryRenderer.appendStatusWarnings(result.injury, resultDiv);

    if (isGlitchMode) {
      const allResults = [result.injury, ...(result.additionalInjuries || []).map(i => i.injury)];
      const glitchCount = allResults.filter(i => i.glitch === 1).length;
      if (glitchCount > 0) {
        const countDiv = document.createElement('div');
        countDiv.className = 'glitch-count-note mt-10';
        countDiv.innerHTML = `${Icons.zap} <b>${glitchCount} glitch${glitchCount !== 1 ? 'es' : ''} generated</b>`;
        resultDiv.appendChild(countDiv);
      }
    }

    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(resultDiv);

    if (!isGlitchMode) {
      const eligibleInjuries = [
        result.injury,
        ...(result.additionalInjuries || []).map(a => a.injury)
      ].filter(inj => inj.id && LastingInjuriesEngine.isMutationEligible(inj.id));
      const showName = eligibleInjuries.length > 1;
      eligibleInjuries.forEach(inj => {
        resultsContainer.appendChild(this.createMutationCheckSection(inj, showName));
      });
    }
  },

  createMutationCheckSection(injury, showName = false) {
    const section = document.createElement('div');
    section.className = 'mutation-check-section mt-20';

    const btn = document.createElement('button');
    btn.className = 'btn btn-chaos';
    btn.textContent = showName ? `Chaos Gang: Check for Mutation — ${injury.name}` : 'Chaos Gang: Check for Mutation';
    btn.addEventListener('click', () => {
      section.innerHTML = '';
      section.appendChild(this.buildMutationTestPanel(injury));
    });

    section.appendChild(btn);
    return section;
  },

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
      <h3 class="mt-0">Mutation Test</h3>
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
        const mutBox = InjuryRenderer.createInjuryBox(mutation, 'purple');
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
