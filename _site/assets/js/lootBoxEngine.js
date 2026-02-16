// lootBoxEngine.js

const LootBoxEngine = {
  lootData: null,

  loadLootData(data) {
    // Store the full loot box data structure with all tables
    this.lootData = data;
  },

  getTable(tableName) {
    if (!this.lootData || !this.lootData[tableName]) {
      console.error(`Table not found: ${tableName}`);
      return null;
    }
    return this.lootData[tableName];
  },

  rollDiceForTable(tableName) {
    const table = this.getTable(tableName);
    if (!table) return null;

    // Roll based on the sides property (6, 66, 3, etc.)
    if (table.sides === 66) {
      return Dice.d66();
    } else if (table.sides === 6) {
      return Dice.d6();
    } else if (table.sides === 3) {
      return Dice.d(3);
    } else {
      console.error(`Unknown sides: ${table.sides}`);
      return null;
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

  processIncome(incomeRule) {
    if (!incomeRule) return null;

    const { schema, sides, multiplier } = incomeRule;
    
    // Roll the dice
    const roll = sides ? Dice.d(sides) : 0;
    const amount = roll * (multiplier || 1);

    return {
      schema,
      roll,
      sides,
      multiplier,
      amount
    };
  },

  processRandomEffect(randomeffect) {
    if (!randomeffect) return null;

    // Handle reroll case
    if (randomeffect === 'reroll') {
      return { type: 'reroll', message: 'Reroll this result' };
    }

    // Handle nested table rolls - don't auto-roll, return pending state
    if (this.lootData[randomeffect]) {
      return {
        type: 'pending_roll',
        tableName: randomeffect,
        tableData: this.getTable(randomeffect)
      };
    }

    return { type: 'unknown', value: randomeffect };
  },

  // Roll a specific nested table
  rollNestedTable(tableName) {
    const maxRerolls = 100; // Safety limit
    let attempts = 0;
    let rerollHistory = [];
    let roll, result, randomEffect;

    // Keep rolling until we get a non-reroll result
    do {
      roll = this.rollDiceForTable(tableName);
      if (roll === null) {
        return {
          error: `Failed to roll ${tableName}. Data not loaded.`
        };
      }

      result = this.findResult(tableName, roll);
      if (!result) {
        return {
          roll,
          error: `No result found for roll ${roll} in table ${tableName}.`
        };
      }

      // Process nested random effects
      randomEffect = this.processRandomEffect(result.randomeffect);

      // If it's a reroll, track it and loop again
      if (randomEffect && randomEffect.type === 'reroll') {
        rerollHistory.push({
          roll: roll,
          name: result.name
        });
        attempts++;

        // Safety check to prevent infinite loops
        if (attempts >= maxRerolls) {
          return {
            error: `Too many rerolls (${maxRerolls}) for ${tableName}. Stopping.`
          };
        }
      }
    } while (randomEffect && randomEffect.type === 'reroll');

    return {
      tableName,
      roll,
      result,
      randomEffect,
      rerollHistory: rerollHistory.length > 0 ? rerollHistory : null
    };
  },

  openLootBox() {
    const roll = this.rollDiceForTable('loot_box_roll');
    if (roll === null) {
      return {
        error: 'Failed to roll. Data not loaded.'
      };
    }

    const result = this.findResult('loot_box_roll', roll);
    if (!result) {
      return {
        roll,
        error: 'No result found for this roll.'
      };
    }

    // Process income if present
    const incomeResult = result.income ? this.processIncome(result.income) : null;

    // Process random effects if present
    const randomEffect = this.processRandomEffect(result.randomeffect);

    return {
      roll,
      result,
      incomeResult,
      randomEffect
    };
  },

  // Test with a specific roll value
  testRoll(rollValue, autoResolveNested = false) {
    const roll = parseInt(rollValue);
    if (isNaN(roll)) {
      console.error(`Invalid roll value: ${rollValue}`);
      return null;
    }

    const result = this.findResult('loot_box_roll', roll);
    if (!result) {
      return {
        roll,
        error: 'No result found for this roll.'
      };
    }

    // Process income if present
    const incomeResult = result.income ? this.processIncome(result.income) : null;

    // Process random effects if present
    let randomEffect = this.processRandomEffect(result.randomeffect);

    // Auto-resolve nested tables if requested
    if (autoResolveNested && randomEffect && randomEffect.type === 'pending_roll') {
      const nestedResult = this.rollNestedTable(randomEffect.tableName);
      randomEffect = {
        type: 'nested_table',
        tableName: nestedResult.tableName,
        roll: nestedResult.roll,
        result: nestedResult.result,
        nestedEffect: nestedResult.randomEffect
      };
    }

    return {
      roll,
      result,
      incomeResult,
      randomEffect
    };
  },

  // Test a nested table directly
  testNestedTable(tableName, rollValue = null) {
    if (!this.getTable(tableName)) {
      console.error(`Table not found: ${tableName}`);
      return { error: `Table not found: ${tableName}` };
    }

    // If rollValue specified, test that specific roll (no auto-reroll)
    if (rollValue !== null) {
      const roll = parseInt(rollValue);
      if (isNaN(roll)) {
        console.error(`Invalid roll value: ${rollValue}`);
        return null;
      }

      const result = this.findResult(tableName, roll);
      if (!result) {
        return {
          roll,
          error: `No result found for roll ${roll} in table ${tableName}.`
        };
      }

      const randomEffect = this.processRandomEffect(result.randomeffect);

      return {
        tableName,
        roll,
        result,
        randomEffect
      };
    }

    // Otherwise use the automatic reroll logic
    return this.rollNestedTable(tableName);
  },

  // Resolve a specific table (useful for testing or specific UI interactions)
  rollTable(tableName) {
    const roll = this.rollDiceForTable(tableName);
    if (roll === null) {
      return {
        error: `Failed to roll ${tableName}. Data not loaded.`
      };
    }

    const result = this.findResult(tableName, roll);
    if (!result) {
      return {
        roll,
        error: `No result found for roll ${roll} in table ${tableName}.`
      };
    }

    // Process random effects if present
    const randomEffect = this.processRandomEffect(result.randomeffect);

    return {
      tableName,
      roll,
      result,
      randomEffect
    };
  }
};
