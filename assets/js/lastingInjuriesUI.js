// lastingInjuriesUI.js

const LastingInjuriesUI = {
  injuriesData: null,

  createWarningBox(type, message) {
    const configs = {
      convalescence: {
        className: "warning-box",
        icon: "⚠️",
        label: "Convalescence"
      },
      recovery: {
        className: "recovery-box",
        icon: "🏥",
        label: "Into Recovery"
      }
    };

    const config = configs[type];
    const div = document.createElement("div");
    div.className = config.className;
    div.innerHTML = `${config.icon} <b>${config.label}:</b> ${message}`;
    return div;
  },

  createInjuryBox(injury, colour, rollInfo = null) {
    const injDiv = document.createElement("div");
    injDiv.className = `result-box result-box-${colour || 'grey'}`;
    injDiv.innerHTML = `
      ${rollInfo ? `<div class="result-heading result-roll">${rollInfo}</div>` : ''}
      <div class="result-heading result-name ${rollInfo ? 'mt-5' : ''}"><b>${injury.name}</b></div>
      ${injury.fixedeffect ? `<div class="result-effect">${injury.fixedeffect}</div>` : ''}
    `;
    return injDiv;
  },

  formatRandomEffect(randomeffect, randomRoll) {
    if (!randomRoll) return randomeffect;

    if (randomeffect === 'd3xpgain') {
      return `Rolled ${randomRoll.type.toUpperCase()}: <b>${randomRoll.value}</b> - Gain ${randomRoll.value} XP!`;
    } else if (randomeffect === 'd3multipleinjuries') {
      return `Rolled ${randomRoll.type.toUpperCase()}: <b>${randomRoll.value}</b> - Suffer ${randomRoll.value} additional injuries (see below)`;
    }
    return randomeffect;
  },

  // Display additional injuries (DRY helper)
  displayAdditionalInjuries(injuries, parentDiv, rollLabelFormat = 'Roll') {
    if (!injuries || injuries.length === 0) return;

    const additionalContainer = document.createElement("div");
    additionalContainer.className = "additional-injuries-container";

    const additionalTitle = document.createElement("h4");
    additionalTitle.textContent = "Additional Injuries:";
    additionalContainer.appendChild(additionalTitle);

    // Track warnings to show once at the end
    let hasConvalescence = false;
    let hasRecovery = false;

    injuries.forEach((injuryResult, index) => {
      const injColour = injuryResult.injury.colour || "grey";

      const rollLabel = rollLabelFormat === 'D66' 
        ? `<b>D66 Roll:</b> ${injuryResult.roll}`
        : `<b>${rollLabelFormat} ${index + 1}:</b> ${injuryResult.roll}`;

      const injDiv = this.createInjuryBox(
        injuryResult.injury,
        injColour,
        rollLabel
      );
      if (index > 0) injDiv.classList.add('mt-10');
      additionalContainer.appendChild(injDiv);

      // Check flags
      if (injuryResult.injury.convalescence === 1) hasConvalescence = true;
      if (injuryResult.injury.intoRecovery === 1) hasRecovery = true;
    });

    // Add warnings at the end
    if (hasConvalescence) {
      additionalContainer.appendChild(
        this.createWarningBox("convalescence", "This fighter cannot participate in the next battle (but can still take Post Battle actions).")
      );
    }

    if (hasRecovery) {
      additionalContainer.appendChild(
        this.createWarningBox("recovery", "This fighter goes into recovery. They cannot make Post Battle actions AND they miss the next battle.")
      );
    }

    parentDiv.appendChild(additionalContainer);
  },

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

      // Expose test function to window for console testing
      window.testInjury = (roll) => {
        const result = LastingInjuriesEngine.testRoll(roll);
        if (result) {
          this.displayResult(result);
          console.log('Test result for roll ' + roll + ':', result);
        }
      };

      window.testRogueDoc = (mode) => {
        const validMode = mode || 'trading_post_rogue_doc';
        const result = LastingInjuriesEngine.resolveRogueDoc(validMode);
        this.displayRogueDocResult(result);
        console.log('Test rogue doc result for mode ' + validMode + ':', result);
      };

      console.log('%c💉 Injury Testing Enabled', 'color: #c71585; font-weight: bold; font-size: 14px;');
      console.log('Use: testInjury(roll) - e.g., testInjury(11) for Standard mode or testInjury(6) for Ironman mode');
      console.log('Use: testRogueDoc(mode) - e.g., testRogueDoc("trading_post_rogue_doc") or testRogueDoc("hanger_on_rogue_doc")');
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

    // Rogue Doc button event
    const rogueDocButton = document.getElementById("resolve-rogue-doc");
    if (rogueDocButton) {
      rogueDocButton.addEventListener("click", () => {
        this.resolveRogueDoc();
      });
    }
  },

  initTimers() {
    // Create timer container for lasting injuries button
    const injuryButton = document.getElementById("resolve-lasting-injuries");
    if (injuryButton && typeof TimerUtil !== 'undefined') {
      const timerContainer = document.createElement("div");
      timerContainer.id = "lasting-injuries-timer";
      timerContainer.className = "mt-15";
      injuryButton.parentNode.insertBefore(timerContainer, injuryButton.nextSibling);
      TimerUtil.init('lasting-injuries-timer', 'lastingInjuriesLastRun');
    }

    // Create timer container for rogue doc button
    const rogueDocButton = document.getElementById("resolve-rogue-doc");
    if (rogueDocButton && typeof TimerUtil !== 'undefined') {
      const rogueTimerContainer = document.createElement("div");
      rogueTimerContainer.id = "rogue-doc-timer";
      rogueTimerContainer.className = "mt-15";
      rogueDocButton.parentNode.insertBefore(rogueTimerContainer, rogueDocButton.nextSibling);
      TimerUtil.init('rogue-doc-timer', 'rogueDocLastRun');
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
        <h2 class="mt-0">💀 Fighter Dies 💀</h2>
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
    resultDiv.innerHTML = `
      ${result.cost !== null ? `<h3 class="result-heading mt-0">Cost: ${result.cost} credits</h3>` : ''}
      <h3 class="result-heading ${result.cost !== null ? 'mt-10' : 'mt-0'}">Treatment Roll: ${result.roll}</h3>
      <h2 class="result-heading text-capitalize">${result.outcome.name}</h2>
      ${result.outcome.fixedeffect ? `<div class="result-effect mt-10">${result.outcome.fixedeffect}</div>` : ''}
      ${result.outcome.randomeffect === 'stabilisedinjury' ? `<div class="mt-10">The fighter is stabilised. Roll a lasting injury.</div>` : ''}
    `;

    if (result.outcome.randomeffect === 'stabilisedinjury' && result.stabilisedInjury) {
      const injuryContainer = document.createElement("div");
      injuryContainer.className = "additional-injuries-container";
      injuryContainer.innerHTML = '<h4>Stabilised Injury:</h4>';

      const injColour = result.stabilisedInjury.injury.colour || "grey";
      injuryContainer.appendChild(this.createInjuryBox(
        result.stabilisedInjury.injury,
        injColour,
        `<b>D66 Roll:</b> ${result.stabilisedInjury.roll}`
      ));
      resultDiv.appendChild(injuryContainer);

      if (result.stabilisedInjury.injury.randomeffect && result.stabilisedInjury.randomRoll) {
        const randomDiv = document.createElement("div");
        randomDiv.className = 'mt-10';
        randomDiv.innerHTML = this.formatRandomEffect(
          result.stabilisedInjury.injury.randomeffect,
          result.stabilisedInjury.randomRoll
        );
        resultDiv.appendChild(randomDiv);

        this.displayAdditionalInjuries(
          result.stabilisedInjury.additionalInjuries,
          resultDiv,
          'D66'
        );
      }
    }

    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(resultDiv);
  },

  changeMode(mode) {
    LastingInjuriesEngine.setMode(mode);
    // Clear previous results when switching modes
    const resultsContainer = document.getElementById("lasting-injuries-results");
    if (resultsContainer) {
      resultsContainer.innerHTML = "";
    }
  },

  resolveInjury() {
    // Mark the run time and show this timer
    if (typeof TimerUtil !== 'undefined') {
      TimerUtil.markRun('lastingInjuriesLastRun');
      TimerUtil.showTimer('lasting-injuries-timer');
    }
    
    // Clear rogue doc results
    const rogueDocResults = document.getElementById("rogue-doc-results");
    if (rogueDocResults) rogueDocResults.innerHTML = "";
    
    const result = LastingInjuriesEngine.resolveInjury();
    this.displayResult(result);
  },

  displayResult(result) {
    const resultsContainer = document.getElementById("lasting-injuries-results");
    if (!resultsContainer) return;

    const colour = result.injury.colour || "grey";
    const nameText = colour === 'black' ? `💀 ${result.injury.name} 💀` : result.injury.name;

    const resultDiv = document.createElement("div");
    resultDiv.className = `result-box result-box-${colour} result-box-primary mt-20`;
    resultDiv.innerHTML = `
      <h2 class="result-heading mt-0">Roll: ${result.roll}</h2>
      <h3 class="result-heading">${nameText}</h3>
      ${result.injury.fixedeffect ? `<div class="result-effect mt-10">${result.injury.fixedeffect}</div>` : ''}
      ${result.injury.randomeffect ? `<div class="mt-15">${this.formatRandomEffect(result.injury.randomeffect, result.randomRoll)}</div>` : ''}
    `;

    this.displayAdditionalInjuries(result.additionalInjuries, resultDiv, 'Roll');

    if (result.injury.convalescence === 1) {
      resultDiv.appendChild(
        this.createWarningBox("convalescence", "This fighter make Post Battle actions (but recovers in time for the next battle).")
      );
    }

    if (result.injury.intoRecovery === 1) {
      resultDiv.appendChild(
        this.createWarningBox("recovery", "This fighter goes into recovery. They cannot make Post Battle actions AND they miss the next battle.")
      );
    }

    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(resultDiv);
  }
};
