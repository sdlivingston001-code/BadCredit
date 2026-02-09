// lastingInjuriesUI.js

const LastingInjuriesUI = {
  injuriesData: null,

  colorSchemes: {
    green: {
      bg: "#d4edda",
      border: "#28a745",
      text: "#155724",
      heading: "#0c5c2c"
    },
    blue: {
      bg: "#d1ecf1",
      border: "#17a2b8",
      text: "#0c5460",
      heading: "#074b57"
    },
    yellow: {
      bg: "#fff3cd",
      border: "#ffc107",
      text: "#856404",
      heading: "#533f03"
    },
    red: {
      bg: "#f8d7da",
      border: "#dc3545",
      text: "#721c24",
      heading: "#491217"
    },
    grey: {
      bg: "#e2e3e5",
      border: "#6c757d",
      text: "#383d41",
      heading: "#1b1e21"
    },
    black: {
      bg: "#000",
      border: "#000",
      text: "#fff",
      heading: "#fff"
    }
  },

  getColorScheme(colour) {
    return this.colorSchemes[colour] || this.colorSchemes.grey;
  },

  createWarningBox(type, message) {
    const configs = {
      convalescence: {
        bg: "#fff3cd",
        border: "#ffc107",
        text: "#856404",
        icon: "⚠️",
        label: "Convalescence"
      },
      recovery: {
        bg: "#f8d7da",
        border: "#dc3545",
        text: "#721c24",
        icon: "🏥",
        label: "Into Recovery"
      }
    };

    const config = configs[type];
    const div = document.createElement("div");
    div.style.marginTop = "15px";
    div.style.padding = "10px";
    div.style.backgroundColor = config.bg;
    div.style.border = `2px solid ${config.border}`;
    div.style.borderRadius = "4px";
    div.innerHTML = `${config.icon} <strong>${config.label}:</strong> ${message}`;
    div.style.color = config.text;
    return div;
  },

  createInjuryBox(injury, scheme, rollInfo = null) {
    const injDiv = document.createElement("div");
    injDiv.style.padding = "12px";
    injDiv.style.borderRadius = "4px";
    injDiv.style.backgroundColor = scheme.bg;
    injDiv.style.border = `2px solid ${scheme.border}`;
    injDiv.style.color = scheme.text;

    if (rollInfo) {
      const rollText = document.createElement("div");
      rollText.innerHTML = rollInfo;
      rollText.style.color = scheme.heading;
      injDiv.appendChild(rollText);
    }

    const nameText = document.createElement("div");
    nameText.innerHTML = `<strong>${injury.name}</strong>`;
    nameText.style.marginTop = rollInfo ? "5px" : "0";
    nameText.style.color = scheme.heading;
    injDiv.appendChild(nameText);

    if (injury.fixedeffect) {
      const effectDiv = document.createElement("div");
      effectDiv.innerHTML = injury.fixedeffect;
      effectDiv.style.marginTop = "5px";
      effectDiv.style.lineHeight = "1.5";
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
    additionalContainer.style.marginTop = "20px";

    const additionalTitle = document.createElement("h4");
    additionalTitle.textContent = "Additional Injuries:";
    additionalTitle.style.marginTop = "0";
    additionalTitle.style.marginBottom = "10px";
    additionalContainer.appendChild(additionalTitle);

    // Track warnings to show once at the end
    let hasConvalescence = false;
    let hasRecovery = false;

    injuries.forEach((injuryResult, index) => {
      const injColour = injuryResult.injury.colour || "grey";
      const injScheme = this.getColorScheme(injColour);

      const rollLabel = rollLabelFormat === 'D66' 
        ? `<strong>D66 Roll:</strong> ${injuryResult.roll}`
        : `<strong>${rollLabelFormat} ${index + 1}:</strong> ${injuryResult.roll}`;

      const injDiv = this.createInjuryBox(
        injuryResult.injury,
        injScheme,
        rollLabel
      );
      injDiv.style.marginTop = index > 0 ? "10px" : "0";
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

      // Pass data to engine
      LastingInjuriesEngine.loadInjuries(this.injuriesData);

      // Render mode selector
      this.renderModeSelector();
      this.renderRogueDocSelector();
      
      this.bindEvents();

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
      const container = document.getElementById("lasting-injuries-container");
      if (container) {
        container.textContent = "Error loading lasting injuries data.";
      }
    }
  },

  renderModeSelector() {
    const container = document.getElementById("lasting-injuries-container");
    if (!container) return;

    container.innerHTML = '';

    // Create mode selector
    const selectorDiv = document.createElement("div");
    selectorDiv.style.marginBottom = "20px";

    const label = document.createElement("label");
    label.textContent = "Select Injury Mode: ";
    label.style.marginRight = "10px";
    label.style.fontWeight = "bold";
    selectorDiv.appendChild(label);

    const select = document.createElement("select");
    select.id = "injury-mode-selector";
    select.style.padding = "8px 12px";
    select.style.fontSize = "16px";
    select.style.borderRadius = "4px";
    select.style.border = "2px solid #333";
    select.style.backgroundColor = "white";
    select.style.cursor = "pointer";

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
    selectorDiv.style.marginBottom = "20px";

    const label = document.createElement("label");
    label.textContent = "Select Treatment Mode: ";
    label.style.marginRight = "10px";
    label.style.fontWeight = "bold";
    selectorDiv.appendChild(label);

    const select = document.createElement("select");
    select.id = "rogue-doc-mode-selector";
    select.style.padding = "8px 12px";
    select.style.fontSize = "16px";
    select.style.borderRadius = "4px";
    select.style.border = "2px solid #333";
    select.style.backgroundColor = "white";
    select.style.cursor = "pointer";

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

  resolveRogueDoc() {
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

    const costDiv = document.createElement("div");
    costDiv.style.marginTop = "20px";
    costDiv.style.padding = "20px";
    costDiv.style.borderRadius = "4px";
    costDiv.style.backgroundColor = "#fff3cd";
    costDiv.style.border = "3px solid #ffc107";
    costDiv.style.textAlign = "center";

    const costTitle = document.createElement("h2");
    costTitle.textContent = "Treatment Cost";
    costTitle.style.marginTop = "0";
    costTitle.style.color = "#856404";
    costDiv.appendChild(costTitle);

    const costAmount = document.createElement("h1");
    costAmount.textContent = `${cost} credits`;
    costAmount.style.color = "#533f03";
    costAmount.style.margin = "20px 0";
    costDiv.appendChild(costAmount);

    const warningText = document.createElement("p");
    warningText.textContent = "Do you want to proceed with treatment?";
    warningText.style.fontSize = "16px";
    warningText.style.color = "#856404";
    warningText.style.marginBottom = "20px";
    costDiv.appendChild(warningText);

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "15px";
    buttonContainer.style.justifyContent = "center";

    const proceedButton = document.createElement("button");
    proceedButton.textContent = "Proceed with Treatment";
    proceedButton.style.padding = "12px 24px";
    proceedButton.style.fontSize = "16px";
    proceedButton.style.backgroundColor = "#28a745";
    proceedButton.style.color = "white";
    proceedButton.style.border = "none";
    proceedButton.style.borderRadius = "4px";
    proceedButton.style.cursor = "pointer";
    proceedButton.style.fontWeight = "bold";
    proceedButton.addEventListener("click", () => {
      const result = LastingInjuriesEngine.resolveRogueDoc(mode, cost);
      this.displayRogueDocResult(result);
    });
    buttonContainer.appendChild(proceedButton);

    const refuseButton = document.createElement("button");
    refuseButton.textContent = "Refuse Treatment";
    refuseButton.style.padding = "12px 24px";
    refuseButton.style.fontSize = "16px";
    refuseButton.style.backgroundColor = "#dc3545";
    refuseButton.style.color = "white";
    refuseButton.style.border = "none";
    refuseButton.style.borderRadius = "4px";
    refuseButton.style.cursor = "pointer";
    refuseButton.style.fontWeight = "bold";
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
    deathDiv.style.marginTop = "20px";
    deathDiv.style.padding = "20px";
    deathDiv.style.borderRadius = "4px";
    deathDiv.style.backgroundColor = "#000";
    deathDiv.style.border = "3px solid #000";
    deathDiv.style.color = "#fff";
    deathDiv.style.textAlign = "center";

    const deathTitle = document.createElement("h2");
    deathTitle.textContent = "💀 Fighter Dies 💀";
    deathTitle.style.marginTop = "0";
    deathTitle.style.color = "#fff";
    deathDiv.appendChild(deathTitle);

    const deathText = document.createElement("p");
    deathText.innerHTML = "Without medical treatment, the fighter succumbs to their injuries and dies.<br><br>You recover their equipment.";
    deathText.style.fontSize = "16px";
    deathText.style.marginBottom = "0";
    deathDiv.appendChild(deathText);

    resultsContainer.appendChild(deathDiv);
  },

  displayRogueDocResult(result) {
    const resultsContainer = document.getElementById("rogue-doc-results");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";

    const resultDiv = document.createElement("div");
    resultDiv.style.marginTop = "20px";
    resultDiv.style.padding = "15px";
    resultDiv.style.borderRadius = "4px";

    const colour = result.outcome.colour || "grey";
    const scheme = this.getColorScheme(colour);
    
    resultDiv.style.backgroundColor = scheme.bg;
    resultDiv.style.border = `3px solid ${scheme.border}`;
    resultDiv.style.color = scheme.text;

    // Display cost if applicable
    if (result.cost !== null) {
      const costText = document.createElement("h3");
      costText.textContent = `Cost: ${result.cost} credits`;
      costText.style.marginTop = "0";
      costText.style.color = scheme.heading;
      resultDiv.appendChild(costText);
    }

    // Display roll
    const rollText = document.createElement("h3");
    rollText.textContent = `Treatment Roll: ${result.roll}`;
    rollText.style.marginTop = result.cost !== null ? "10px" : "0";
    rollText.style.color = scheme.heading;
    resultDiv.appendChild(rollText);

    // Display outcome name
    const nameText = document.createElement("h2");
    nameText.textContent = result.outcome.name;
    nameText.style.color = scheme.heading;
    nameText.style.textTransform = "capitalize";
    resultDiv.appendChild(nameText);

    // Display fixed effect
    if (result.outcome.fixedeffect) {
      const fixedEffectDiv = document.createElement("div");
      fixedEffectDiv.style.marginTop = "10px";
      fixedEffectDiv.style.lineHeight = "1.5";
      fixedEffectDiv.innerHTML = result.outcome.fixedeffect;
      resultDiv.appendChild(fixedEffectDiv);
    }

    // Display random effect
    if (result.outcome.randomeffect === 'stabilisedinjury') {
      const randomEffectDiv = document.createElement("div");
      randomEffectDiv.style.marginTop = "10px";
      randomEffectDiv.innerHTML = "The fighter is stabilised and removed from recovery.";
      resultDiv.appendChild(randomEffectDiv);

      // Display the stabilised injury if present
      if (result.stabilisedInjury) {
        const injuryContainer = document.createElement("div");
        injuryContainer.style.marginTop = "20px";

        const injuryTitle = document.createElement("h4");
        injuryTitle.textContent = "Stabilised Injury:";
        injuryTitle.style.marginTop = "0";
        injuryTitle.style.marginBottom = "10px";
        injuryContainer.appendChild(injuryTitle);

        const injColour = result.stabilisedInjury.injury.colour || "grey";
        const injScheme = this.getColorScheme(injColour);

        const injDiv = this.createInjuryBox(
          result.stabilisedInjury.injury,
          injScheme,
          `<strong>D66 Roll:</strong> ${result.stabilisedInjury.roll}`
        );

        injuryContainer.appendChild(injDiv);
        resultDiv.appendChild(injuryContainer);

        // Display random effects on the stabilised injury
        if (result.stabilisedInjury.injury.randomeffect && result.stabilisedInjury.randomRoll) {
          const randomDiv = document.createElement("div");
          randomDiv.style.marginTop = "10px";
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

    const resultDiv = document.createElement("div");
    resultDiv.style.marginTop = "20px";
    resultDiv.style.padding = "15px";
    resultDiv.style.borderRadius = "4px";

    // Apply color scheme based on injury colour property
    const colour = result.injury.colour || "grey";
    const scheme = this.getColorScheme(colour);
    
    resultDiv.style.backgroundColor = scheme.bg;
    resultDiv.style.border = `3px solid ${scheme.border}`;
    resultDiv.style.color = scheme.text;

    // Display roll
    const rollText = document.createElement("h2");
    rollText.textContent = `Roll: ${result.roll}`;
    rollText.style.marginTop = "0";
    rollText.style.color = scheme.heading;
    resultDiv.appendChild(rollText);

    // Display injury name
    const nameText = document.createElement("h3");
    nameText.textContent = colour === 'black' ? `💀 ${result.injury.name} 💀` : result.injury.name;
    nameText.style.color = scheme.heading;
    resultDiv.appendChild(nameText);

    // Display fixed effect
    if (result.injury.fixedeffect) {
      const fixedEffectDiv = document.createElement("div");
      fixedEffectDiv.style.marginTop = "10px";
      fixedEffectDiv.style.lineHeight = "1.5";
      fixedEffectDiv.innerHTML = result.injury.fixedeffect;
      resultDiv.appendChild(fixedEffectDiv);
    }

    // Display random effect
    if (result.injury.randomeffect) {
      const randomEffectDiv = document.createElement("div");
      randomEffectDiv.style.marginTop = "15px";
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
