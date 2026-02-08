// lastingInjuriesUI.js

const LastingInjuriesUI = {
  injuries: [],

  async init(jsonPath) {
    try {
      const response = await fetch(`${jsonPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load lasting injuries: ${response.status}`);
      }

      this.injuries = await response.json();

      // Convert object to array if needed
      if (!Array.isArray(this.injuries)) {
        this.injuries = Object.entries(this.injuries).map(([id, data]) => ({
          id,
          ...data
        }));
      }

      // Pass data to engine
      LastingInjuriesEngine.loadInjuries(this.injuries);

      this.bindEvents();
    } catch (err) {
      console.error(err);
      const container = document.getElementById("lasting-injuries-container");
      if (container) {
        container.textContent = "Error loading lasting injuries data.";
      }
    }
  },

  bindEvents() {
    const button = document.getElementById("resolve-lasting-injuries");
    if (button) {
      button.addEventListener("click", () => {
        this.resolveInjury();
      });
    }
  },

  resolveInjury() {
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
    resultDiv.style.border = "2px solid #333";
    resultDiv.style.backgroundColor = "#f9f9f9";

    // Display roll
    const rollText = document.createElement("h2");
    rollText.textContent = `Roll: ${result.roll}`;
    rollText.style.marginTop = "0";
    resultDiv.appendChild(rollText);

    // Display injury name
    const nameText = document.createElement("h3");
    nameText.textContent = result.injury.name;
    nameText.style.color = "#c71585";
    resultDiv.appendChild(nameText);

    // Display fixed effect
    if (result.injury.fixedeffect) {
      const fixedEffectDiv = document.createElement("div");
      fixedEffectDiv.style.marginTop = "10px";
      
      const fixedLabel = document.createElement("strong");
      fixedLabel.textContent = "Effect: ";
      fixedEffectDiv.appendChild(fixedLabel);
      
      const fixedText = document.createElement("span");
      fixedText.innerHTML = result.injury.fixedeffect;
      fixedEffectDiv.appendChild(fixedText);
      
      resultDiv.appendChild(fixedEffectDiv);
    }

    // Display random effect
    if (result.injury.randomeffect) {
      const randomEffectDiv = document.createElement("div");
      randomEffectDiv.style.marginTop = "10px";
      
      const randomLabel = document.createElement("strong");
      randomLabel.textContent = "Random Effect: ";
      randomEffectDiv.appendChild(randomLabel);
      
      const randomText = document.createElement("span");
      randomText.innerHTML = result.injury.randomeffect;
      randomEffectDiv.appendChild(randomText);
      
      resultDiv.appendChild(randomEffectDiv);
    }

    // Display convalescence marker
    if (result.injury.convalescence === 1) {
      const convalescenceDiv = document.createElement("div");
      convalescenceDiv.style.marginTop = "15px";
      convalescenceDiv.style.padding = "10px";
      convalescenceDiv.style.backgroundColor = "#fff3cd";
      convalescenceDiv.style.border = "1px solid #ffc107";
      convalescenceDiv.style.borderRadius = "4px";
      
      const convalescenceLabel = document.createElement("strong");
      convalescenceLabel.textContent = "⚠️ Convalescence: ";
      convalescenceLabel.style.color = "#856404";
      convalescenceDiv.appendChild(convalescenceLabel);
      
      const convalescenceText = document.createElement("span");
      convalescenceText.style.color = "#856404";
      convalescenceText.textContent = "This fighter must miss the next battle to recover.";
      convalescenceDiv.appendChild(convalescenceText);
      
      resultDiv.appendChild(convalescenceDiv);
    }

    // Display into recovery marker
    if (result.injury.intoRecovery === 1) {
      const recoveryDiv = document.createElement("div");
      recoveryDiv.style.marginTop = "15px";
      recoveryDiv.style.padding = "10px";
      recoveryDiv.style.backgroundColor = "#f8d7da";
      recoveryDiv.style.border = "1px solid #dc3545";
      recoveryDiv.style.borderRadius = "4px";
      
      const recoveryLabel = document.createElement("strong");
      recoveryLabel.textContent = "🏥 Into Recovery: ";
      recoveryLabel.style.color = "#721c24";
      recoveryDiv.appendChild(recoveryLabel);
      
      const recoveryText = document.createElement("span");
      recoveryText.style.color = "#721c24";
      recoveryText.textContent = "This fighter enters recovery and must make recovery rolls.";
      recoveryDiv.appendChild(recoveryText);
      
      resultDiv.appendChild(recoveryDiv);
    }

    resultsContainer.appendChild(resultDiv);
  }
};
