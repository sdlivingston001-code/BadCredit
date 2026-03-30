// injuryRenderer.js
// Shared injury rendering utilities used by LastingInjuriesUI and PostBattleUI.
// Depends on: icons.js

const InjuryRenderer = {

  MESSAGES: {
    convalescence: "This fighter cannot make <b>Post Battle Actions</b> (but are available for the next battle as normal).",
    recovery: "This fighter goes <b>into recovery</b>. They cannot make Post Battle Actions AND they miss the next battle."
  },

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

  // Appends convalescence/intoRecovery warning boxes to parentEl if the injury requires them.
  appendStatusWarnings(injury, parentEl) {
    if (injury.convalescence === 1) {
      parentEl.appendChild(this.createWarningBox("convalescence", this.MESSAGES.convalescence));
    }
    if (injury.intoRecovery === 1) {
      parentEl.appendChild(this.createWarningBox("recovery", this.MESSAGES.recovery));
    }
  },

  formatRandomEffect(randomeffect, randomRoll) {
    if (!randomRoll) return randomeffect;
    if (randomeffect === 'd3xpgain') return `Gain ${randomRoll.value} XP!`;
    return randomeffect;
  },

  formatRandomEffectLabel(randomeffect) {
    if (!randomeffect) return null;
    if (randomeffect === 'd3xpgain') return 'Gain D3 XP.';
    if (randomeffect === 'd3multipleinjuries') return 'Suffer D3 injuries (ignoring Captured, Multiple Injuries, Memorable Death, Critical Injury, or Out Cold).';
    if (randomeffect === 'stabilisedinjury') return 'Roll a lasting injury on the standard table.';
    return randomeffect;
  },

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
  }

};
