// lastingInjuriesEngine.js

const LastingInjuriesEngine = {
  injuries: [],

  loadInjuries(injuriesData) {
    // Convert object to array if needed
    if (!Array.isArray(injuriesData)) {
      this.injuries = Object.entries(injuriesData).map(([id, data]) => ({
        id,
        ...data
      }));
    } else {
      this.injuries = injuriesData;
    }
  },

  rollD66() {
    return Dice.d66();
  },

  findInjury(roll) {
    for (const injury of this.injuries) {
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

  resolveInjury() {
    const roll = this.rollD66();
    const injury = this.findInjury(roll);
    
    return {
      roll,
      injury: injury || {
        name: 'Unknown',
        fixedeffect: 'No injury found for this roll.',
        randomeffect: null
      }
    };
  }
};
