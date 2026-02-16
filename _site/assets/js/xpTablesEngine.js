// xpTablesEngine.js

const XPTablesEngine = {
  xpData: null,

  loadXPData(data) {
    // Store the full XP tables data structure with all tables
    this.xpData = data;
  },

  getTable(tableName) {
    if (!this.xpData || !this.xpData[tableName]) {
      console.error(`Table not found: ${tableName}`);
      return null;
    }
    return this.xpData[tableName];
  },

  rollDiceForTable(tableName) {
    const table = this.getTable(tableName);
    if (!table) return null;

    // Check if table has a count property (for multiple dice)
    const count = table.count || 1;
    const sides = table.sides;

    if (sides === "d66") {
      return Dice.d66(); // Special case: d66 is not a 66-sided die
    } else {
      const n = typeof sides === 'number' ? sides : parseInt(sides);
      if (count === 1) {
        return Dice.d(n);
      } else {
        // Roll multiple dice and sum them
        const rolls = Dice.rollMany(count, null, n);
        return rolls.reduce((sum, roll) => sum + roll, 0);
      }
    }
  },

  findResult(tableName, roll) {
    const table = this.getTable(tableName);
    if (!table || !table.results) return null;

    // Convert results object to array
    const results = Object.entries(table.results).map(([id, data]) => ({
      id,
      ...data
    }));

    for (const result of results) {
      if (this.isInRange(roll, result.values)) {
        return result;
      }
    }
    return null;
  },

  isInRange(roll, values) {
    // values can be an array like [1] or ["2-3"] or [11, 12, 13]
    for (const value of values) {
      if (typeof value === 'number') {
        if (roll === value) return true;
      } else if (typeof value === 'string' && value.includes('-')) {
        // Handle range like "2-3" or "11-13"
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

  rollAdvancement() {
    const roll = this.rollDiceForTable('advancements_random');
    if (roll === null) {
      return {
        error: 'Failed to roll. Data not loaded.'
      };
    }

    const result = this.findResult('advancements_random', roll);
    if (!result) {
      return {
        roll,
        error: 'No result found for this roll.'
      };
    }

    return {
      roll,
      result
    };
  },

  rollSkillTable(skillTableName) {
    const roll = this.rollDiceForTable(skillTableName);
    if (roll === null) {
      return {
        error: `Failed to roll ${skillTableName}. Data not loaded.`
      };
    }

    const result = this.findResult(skillTableName, roll);
    if (!result) {
      return {
        roll,
        error: `No result found for roll ${roll} in table ${skillTableName}.`
      };
    }

    return {
      tableName: skillTableName,
      roll,
      result
    };
  },

  // Test with a specific roll value
  testRoll(rollValue) {
    const roll = parseInt(rollValue);
    if (isNaN(roll)) {
      console.error(`Invalid roll value: ${rollValue}`);
      return null;
    }

    const result = this.findResult('advancements_random', roll);
    if (!result) {
      return {
        roll,
        error: 'No result found for this roll.'
      };
    }

    return {
      roll,
      result
    };
  },

  // Test a skill table directly
  testSkillTable(skillTableName, rollValue = null) {
    if (!this.getTable(skillTableName)) {
      console.error(`Table not found: ${skillTableName}`);
      return { error: `Table not found: ${skillTableName}` };
    }

    // If rollValue specified, test that specific roll
    if (rollValue !== null) {
      const roll = parseInt(rollValue);
      if (isNaN(roll)) {
        console.error(`Invalid roll value: ${rollValue}`);
        return null;
      }

      const result = this.findResult(skillTableName, roll);
      if (!result) {
        return {
          roll,
          error: `No result found for roll ${roll} in table ${skillTableName}.`
        };
      }

      return {
        tableName: skillTableName,
        roll,
        result
      };
    }

    // Otherwise roll normally
    return this.rollSkillTable(skillTableName);
  },

  // Get all available skill tables
  getSkillTables() {
    if (!this.xpData) return [];
    
    return Object.keys(this.xpData)
      .filter(key => key.startsWith('skill_'))
      .map(key => ({
        id: key,
        name: key.replace('skill_', '').replace('_', ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }));
  }
};
