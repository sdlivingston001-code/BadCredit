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
    div.innerHTML = `${config.icon} <strong>${config.label}:</strong> ${message}`;
    return div;
  },

  createInjuryBox(injury, colour, rollInfo = null) {
    const injDiv = document.createElement("div");
    injDiv.className = `result-box result-box-${colour || 'grey'}`;

    if (rollInfo) {
      const rollText = document.createElement("div");
      rollText.className = "result-heading result-roll";
      rollText.innerHTML = rollInfo;
      injDiv.appendChild(rollText);
    }

    const nameText = document.createElement("div");
    nameText.className = `result-heading result-name ${rollInfo ? 'mt-5' : ''}`;
    nameText.innerHTML = `<strong>${injury.name}</strong>`;
    injDiv.appendChild(nameText);

    if (injury.fixedeffect) {
      const effectDiv = document.createElement("div");
      effectDiv.className = "result-effect";
      effectDiv.innerHTML = injury.fixedeffect;
      injDiv.appendChild(effectDiv);
    }

    return injDiv;
  },

  formatRandomEffect(randomeffect, randomRoll) {
    if (!randomRoll) return randomeffect;

    if (randomeffect === 'd3xpgain') {
      return `Rolled ${randomRoll.type.toUpperCase()}: <strong>${randomRoll.value}</strong> - Gain ${randomRoll.value} XP!`;
    } else if (randomeffect === 'd3multipleinjuries') {
      return `Rolled ${randomRoll.type.toUpperCase()}: <strong>${randomRoll.value}</strong> - Suffer ${randomRoll.value} additional injuries (see below)`;
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
        ? `<strong>D66 Roll:</strong> ${injuryResult.roll}`
        : `<strong>${rollLabelFormat} ${index + 1}:</strong> ${injuryResult.roll}`;

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
      console.log('🔍 Loading injuries from:', jsonPath);
      const fullPath = `${jsonPath}?t=${Date.now()}`;
      console.log('🔍 Full fetch URL:', fullPath);
      
      const response = await fetch(fullPath, { cache: 'no-store' });
      console.log('🔍 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Failed to load lasting injuries: ${response.status} from ${jsonPath}`);
      }

      this.injuriesData = await response.json();
      console.log('✅ Injuries data loaded successfully');
      console.log('🔍 Data keys:', Object.keys(this.injuriesData));

      // Pass data to engine
      LastingInjuriesEngine.loadInjuries(this.injuriesData);
      console.log('✅ Data passed to engine');

      // Render mode selector
      this.renderModeSelector();
      this.renderRogueDocSelector();
      
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
      console.error('❌ Error in init:', err);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      const container = document.getElementById("lasting-injuries-container");
      if (container) {
        container.innerHTML = `<div style="color: red; padding: 20px; border: 2px solid red; border-radius: 4px;">
          <strong>Error loading lasting injuries data:</strong><br>
          ${err.message}<br>
          <em>Check console for details</em>
        </div>`;
      }
    }
  },

  renderModeSelector() {
    const container = document.getElementById("lasting-injuries-container");
    if (!container) return;

    container.innerHTML = '';

    // Create mode selector
    const selectorDiv = document.createElement("div");
    selectorDiv.className = "selector-wrapper";

    const label = document.createElement("label");
    label.className = "selector-label";
    label.textContent = "Select Injury Mode: ";
    selectorDiv.appendChild(label);

    const select = document.createElement("select");
    select.id = "injury-mode-selector";
    select.className = "select-input";

    // Add options
    const standardOption = document.createElement("option");
    standardOption.value = "standard_lasting_injuries";
    standardOption.textContent = "Standard (D66)";
    standardOption.selected = true;
    select.appendChild(standardOption);

    const ironmanOption = document.createElement("option");
    ironmanOption.value = "ironman_lasting_injuries";
    ironmanOption.textContent = "Ironman (D6)";
    select.appendChild(ironmanOption);

    selectorDiv.appendChild(select);
    container.appendChild(selectorDiv);
  },

  renderRogueDocSelector() {
    const container = document.getElementById("rogue-doc-container");
    if (!container) return;

    container.innerHTML = '';

    const selectorDiv = document.createElement("div");
    selectorDiv.className = "selector-wrapper";

    const label = document.createElement("label");
    label.className = "selector-label";
    label.textContent = "Select Treatment Mode: ";
    selectorDiv.appendChild(label);

    const select = document.createElement("select");
    select.id = "rogue-doc-mode-selector";
    select.className = "select-input";

    const tradingPostOption = document.createElement("option");
    tradingPostOption.value = "trading_post_rogue_doc";
    tradingPostOption.textContent = "Trading Post (Post Battle Action)";
    tradingPostOption.selected = true;
    select.appendChild(tradingPostOption);

    const hangerOnOption = document.createElement("option");
    hangerOnOption.value = "hanger_on_rogue_doc";
    hangerOnOption.textContent = "Hanger-on (Patch-Up)";
    select.appendChild(hangerOnOption);

    selectorDiv.appendChild(select);
    container.appendChild(selectorDiv);
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

    // Check if data failed to load
    if (cost === null) {
      resultsContainer.innerHTML = '<div class="error-box">Error: Injury data not loaded. Please refresh the page.</div>';
      return;
    }

    const costDiv = document.createElement("div");
    costDiv.className = "cost-box";

    const costTitle = document.createElement("h2");
    costTitle.textContent = "Treatment Cost";
    costDiv.appendChild(costTitle);

    const costAmount = document.createElement("h1");
    costAmount.textContent = `${cost} credits`;
    costDiv.appendChild(costAmount);

    const warningText = document.createElement("p");
    warningText.textContent = "Do you want to proceed with treatment?";
    warningText.style.fontSize = "16px";
    warningText.classList.add('mb-20');
    costDiv.appendChild(warningText);

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "flex-center";

    const proceedButton = document.createElement("button");
    proceedButton.textContent = "Proceed with Treatment";
    proceedButton.className = "btn btn-success";
    proceedButton.addEventListener("click", () => {
      const result = LastingInjuriesEngine.resolveRogueDoc(mode, cost);
      this.displayRogueDocResult(result);
    });
    buttonContainer.appendChild(proceedButton);

    const refuseButton = document.createElement("button");
    refuseButton.textContent = "Refuse Treatment";
    refuseButton.className = "btn btn-danger";
    refuseButton.addEventListener("click", () => {
      this.displayFighterDeath();
    });
    buttonContainer.appendChild(refuseButton);

    costDiv.appendChild(buttonContainer);
    resultsContainer.appendChild(costDiv);
  },

  displayFighterDeath() {
    const resultsContainer = document.getElementById("rogue-doc-results");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";

    const deathDiv = document.createElement("div");
    deathDiv.className = "death-box";

    const deathTitle = document.createElement("h2");
    deathTitle.textContent = "💀 Fighter Dies 💀";
    deathTitle.classList.add('mt-0');
    deathDiv.appendChild(deathTitle);

    const deathText = document.createElement("p");
    deathText.innerHTML = "Without medical treatment, the fighter succumbs to their injuries and dies.<br><br>You recover their equipment.";
    deathText.style.fontSize = "16px";
    deathText.classList.add('mb-0');
    deathDiv.appendChild(deathText);

    resultsContainer.appendChild(deathDiv);
  },

  displayRogueDocResult(result) {
    const resultsContainer = document.getElementById("rogue-doc-results");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";

    const resultDiv = document.createElement("div");
    const colour = result.outcome.colour || "grey";
    resultDiv.className = `result-box result-box-${colour} mt-20`;
    resultDiv.style.padding = "15px";
    resultDiv.style.borderWidth = "3px";

    // Display cost if applicable
    if (result.cost !== null) {
      const costText = document.createElement("h3");
      costText.className = "result-heading mt-0";
      costText.textContent = `Cost: ${result.cost} credits`;
      resultDiv.appendChild(costText);
    }

    // Display roll
    const rollText = document.createElement("h3");
    rollText.className = `result-heading ${result.cost !== null ? 'mt-10' : 'mt-0'}`;
    rollText.textContent = `Treatment Roll: ${result.roll}`;
    resultDiv.appendChild(rollText);

    // Display outcome name
    const nameText = document.createElement("h2");
    nameText.className = "result-heading";
    nameText.textContent = result.outcome.name;
    nameText.style.textTransform = "capitalize";
    resultDiv.appendChild(nameText);

    // Display fixed effect
    if (result.outcome.fixedeffect) {
      const fixedEffectDiv = document.createElement("div");
      fixedEffectDiv.className = "result-effect";
      fixedEffectDiv.style.marginTop = "10px";
      fixedEffectDiv.innerHTML = result.outcome.fixedeffect;
      resultDiv.appendChild(fixedEffectDiv);
    }

    // Display random effect
    if (result.outcome.randomeffect === 'stabilisedinjury') {
      const randomEffectDiv = document.createElement("div");
      randomEffectDiv.classList.add('mt-10');
      randomEffectDiv.innerHTML = "The fighter is stabilised and removed from recovery.";
      resultDiv.appendChild(randomEffectDiv);

      // Display the stabilised injury if present
      if (result.stabilisedInjury) {
        const injuryContainer = document.createElement("div");
        injuryContainer.className = "additional-injuries-container";

        const injuryTitle = document.createElement("h4");
        injuryTitle.textContent = "Stabilised Injury:";
        injuryContainer.appendChild(injuryTitle);

        const injColour = result.stabilisedInjury.injury.colour || "grey";

        const injDiv = this.createInjuryBox(
          result.stabilisedInjury.injury,
          injColour,
          `<strong>D66 Roll:</strong> ${result.stabilisedInjury.roll}`
        );

        injuryContainer.appendChild(injDiv);
        resultDiv.appendChild(injuryContainer);

        // Display random effects on the stabilised injury
        if (result.stabilisedInjury.injury.randomeffect && result.stabilisedInjury.randomRoll) {
          const randomDiv = document.createElement("div");
          randomDiv.classList.add('mt-10');
          randomDiv.innerHTML = this.formatRandomEffect(
            result.stabilisedInjury.injury.randomeffect,
            result.stabilisedInjury.randomRoll
          );
          resultDiv.appendChild(randomDiv);

          // Display additional injuries using DRY helper
          this.displayAdditionalInjuries(
            result.stabilisedInjury.additionalInjuries,
            resultDiv,
            'D66'
          );
        }

        // Always show Into Recovery warning for stabilised injuries
        resultDiv.appendChild(
          this.createWarningBox("recovery", "This fighter goes into recovery. They cannot make Post Battle actions AND they miss the next battle.")
        );
      }
    }

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

    resultsContainer.innerHTML = "";

    const colour = result.injury.colour || "grey";
    const resultDiv = document.createElement("div");
    resultDiv.className = `result-box result-box-${colour} mt-20`;
    resultDiv.style.padding = "15px";
    resultDiv.style.borderWidth = "3px";

    // Display roll
    const rollText = document.createElement("h2");
    rollText.className = "result-heading mt-0";
    rollText.textContent = `Roll: ${result.roll}`;
    resultDiv.appendChild(rollText);

    // Display injury name
    const nameText = document.createElement("h3");
    nameText.className = "result-heading";
    nameText.textContent = colour === 'black' ? `💀 ${result.injury.name} 💀` : result.injury.name;
    resultDiv.appendChild(nameText);

    // Display fixed effect
    if (result.injury.fixedeffect) {
      const fixedEffectDiv = document.createElement("div");
      fixedEffectDiv.className = "result-effect";
      fixedEffectDiv.style.marginTop = "10px";
      fixedEffectDiv.innerHTML = result.injury.fixedeffect;
      resultDiv.appendChild(fixedEffectDiv);
    }

    // Display random effect
    if (result.injury.randomeffect) {
      const randomEffectDiv = document.createElement("div");
      randomEffectDiv.classList.add('mt-15');
      randomEffectDiv.innerHTML = this.formatRandomEffect(result.injury.randomeffect, result.randomRoll);
      resultDiv.appendChild(randomEffectDiv);
    }

    // Display additional injuries using DRY helper
    this.displayAdditionalInjuries(result.additionalInjuries, resultDiv, 'Roll');

    // Display single injury warnings
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

    resultsContainer.appendChild(resultDiv);
  }
};
