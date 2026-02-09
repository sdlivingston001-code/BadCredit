// lastingInjuriesEngine.js

const LastingInjuriesEngine = {
  injuriesData: null,
  currentMode: 'standard_lasting_injuries',

  loadInjuries(injuriesData) {
    // Store the full data structure with both modes
    this.injuriesData = injuriesData;
  },

  setMode(mode) {
    // mode should be 'standard_lasting_injuries' or 'ironman_lasting_injuries'
    if (this.injuriesData && this.injuriesData[mode]) {
      this.currentMode = mode;
    } else {
      console.error(`Invalid mode: ${mode}`);
    }
  },

  getCurrentModeData() {
    if (!this.injuriesData || !this.injuriesData[this.currentMode]) {
      return null;
    }
    return this.injuriesData[this.currentMode];
  },

  rollDice() {
    const modeData = this.getCurrentModeData();
    if (!modeData) return null;

    // Roll based on the sides property (6 for ironman, 66 for standard)
    if (modeData.sides === 66) {
      return Dice.d66();
    } else if (modeData.sides === 6) {
      return Dice.d6();
    } else {
      console.error(`Unknown sides: ${modeData.sides}`);
      return null;
    }
  },

  findInjury(roll) {
    const modeData = this.getCurrentModeData();
    if (!modeData || !modeData.results) return null;

    // Convert results object to array
    const injuries = Object.entries(modeData.results).map(([id, data]) => ({
      id,
      ...data
    }));

    for (const injury of injuries) {
      if (this.isInRange(roll, injury.values)) {
        return injury;
      }
    }
    return null;
  },

  isInRange(roll, values) {
    // values can be an array like [11] or ["14-66"] or [12, 13, 14]
    for (const value of values) {
      if (typeof value === 'number') {
        if (roll === value) return true;
      } else if (typeof value === 'string' && value.includes('-')) {
        // Handle range like "14-66"
        const [min, max] = value.split('-').map(Number);
        if (roll >= min && roll <= max) return true;
      } else {
        // Try converting string to number
        const num = Number(value);
        if (!isNaN(num) && roll === num) return true;
      }
    }
    return false;
  },

  resolveMultipleInjuries(count) {
    // Excluded injury IDs for multiple injuries
    const excludedIds = ['captured', 'multiple_injuries', 'memorable_death', 'critical_injury', 'out_cold'];
    const injuries = [];
    const maxAttempts = 100; // Prevent infinite loops
    let attempts = 0;

    while (injuries.length < count && attempts < maxAttempts) {
      attempts++;
      const roll = this.rollDice();
      const injury = this.findInjury(roll);
      
      if (injury && !excludedIds.includes(injury.id)) {
        injuries.push({
          roll,
          injury
        });
      }
    }

    return injuries;
  },

  // Process random effects on an injury (DRY helper)
  processRandomEffects(injury) {
    if (!injury || !injury.randomeffect) {
      return { randomRoll: null, additionalInjuries: null };
    }

    let randomRoll = null;
    let additionalInjuries = null;

    if (injury.randomeffect === 'd3xpgain') {
      randomRoll = { type: 'd3', value: Dice.d(3) };
    } else if (injury.randomeffect === 'd3multipleinjuries') {
      const count = Dice.d(3);
      randomRoll = { type: 'd3', value: count };
      additionalInjuries = this.resolveMultipleInjuries(count);
    }

    return { randomRoll, additionalInjuries };
  },

  resolveInjury() {
    const roll = this.rollDice();
    return this.processInjury(roll);
  },

  // Test with a specific roll value
  testRoll(rollValue) {
    const roll = parseInt(rollValue);
    if (isNaN(roll)) {
      console.error(`Invalid roll value: ${rollValue}`);
      return null;
    }
    return this.processInjury(roll);
  },

  // Process an injury result (used by both resolveInjury and testRoll)
  processInjury(roll) {
    if (roll === null) {
      return {
        roll: 'Error',
        injury: {
          name: 'Error',
          fixedeffect: 'Failed to roll dice. Data not loaded.',
          randomeffect: null
        },
        randomRoll: null,
        additionalInjuries: null
      };
    }

    const injury = this.findInjury(roll);
    const { randomRoll, additionalInjuries } = this.processRandomEffects(injury);
    
    return {
      roll,
      injury: injury || {
        name: 'Unknown',
        fixedeffect: 'No injury found for this roll.',
        randomeffect: null
      },
      randomRoll,
      additionalInjuries
    };
  },

  resolveStabilisedInjury() {
    // Roll a single injury from standard table
    const excludedIds = ['captured', 'critical_injury', 'memorable_death'];
    const maxAttempts = 100;
    let attempts = 0;

    // Temporarily switch to standard mode
    const originalMode = this.currentMode;
    this.currentMode = 'standard_lasting_injuries';

    while (attempts < maxAttempts) {
      attempts++;
      const roll = Dice.d66();
      const injury = this.findInjury(roll);
      
      if (injury && !excludedIds.includes(injury.id)) {
        // Restore original mode
        this.currentMode = originalMode;
        return {
          roll,
          injury
        };
      }
    }

    // Restore original mode
    this.currentMode = originalMode;
    return null;
  },

  resolveRogueDoc(mode, precalculatedCost = null) {
    const modeData = this.injuriesData[mode];
    if (!modeData) {
      return {
        cost: null,
        roll: 'Error',
        outcome: {
          name: 'Error',
          fixedeffect: 'Invalid rogue doc mode',
          colour: 'grey'
        },
        stabilisedInjury: null
      };
    }

    // Use precalculated cost if provided, otherwise calculate
    let cost = precalculatedCost;
    if (cost === null && mode === 'trading_post_rogue_doc' && modeData.cost) {
      cost = this.calculateRogueDocCost(mode);
    }

    // Roll for treatment result
    const roll = Dice.d(modeData.sides);
    const outcome = this.findOutcome(roll, modeData.results);

    // If stabilised, roll an injury and process any random effects
    let stabilisedInjury = null;
    if (outcome && outcome.randomeffect === 'stabilisedinjury') {
      stabilisedInjury = this.resolveStabilisedInjury();
      
      if (stabilisedInjury) {
        const { randomRoll, additionalInjuries } = this.processRandomEffects(stabilisedInjury.injury);
        stabilisedInjury.randomRoll = randomRoll;
        stabilisedInjury.additionalInjuries = additionalInjuries;
      }
    }

    return {
      cost,
      roll,
      outcome: outcome || {
        name: 'Unknown',
        fixedeffect: 'No outcome found for this roll.',
        colour: 'grey'
      },
      stabilisedInjury
    };
  },

  calculateRogueDocCost(mode) {
    if (!this.injuriesData) {
      console.error('Injuries data not loaded');
      return null;
    }
    const modeData = this.injuriesData[mode];
    if (!modeData || !modeData.cost) {
      console.error(`Mode data not found for: ${mode}`);
      return null;
    }

    const costConfig = modeData.cost;
    let total = 0;
    for (let i = 0; i < costConfig.count; i++) {
      total += Dice.d(costConfig.sides);
    }
    return (total * costConfig.multiplier) + costConfig.addition;
  },

  findOutcome(roll, results) {
    // Reuse findInjury logic by temporarily setting mode data
    const outcomes = Object.entries(results).map(([id, data]) => ({
      id,
      ...data
    }));

    for (const outcome of outcomes) {
      if (this.isInRange(roll, outcome.values)) {
        return outcome;
      }
    }
    return null;
  }
};
