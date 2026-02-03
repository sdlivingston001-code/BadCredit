// territoryEngine.js

// TerritoryEngine handles all territory-related rules and calculations

const TerritoryEngine = {
  // Main function that processes all territories and applies all rules
  resolveAll(territories) {
    if (!Array.isArray(territories)) return [];

    return territories.map(territory => {
      const income = this.resolveIncome(territory);
      const recruit = this.resolveRecruit(territory);
      // Add more rule types here as needed
      // const special = this.resolveSpecial(territory);

      return {
        id: territory.id,
        territory,
        income,
        recruit
      };
    });
  },

  // Income rules - determines credits earned from a territory
  resolveIncome(territory) {
    // Check if territory has income configuration
    if (!territory.income) {
      return {
        roll: null,
        credits: 0,
        description: "No income for this territory type."
      };
    }

    const income = territory.income;
    const multiplier = income.multiplier || 1;
    const count = income.count || 1;
    const sides = income.sides || 6;
    const addition = income.addition || 0;

    // Roll dice based on configuration: multiplier × count × d(sides)
    const rolls = Dice.rollMany(count, null, sides);
    const total = rolls.reduce((sum, roll) => sum + roll, 0);
    const credits = multiplier * total + addition;

    let description = `Rolled ${count}d${sides}: ${rolls.join('+')} = ${total}. Income: (${multiplier} × ${total}) + ${addition} = ${credits} credits.`;
    
    // Add any additional effect text if provided
    if (income.effect) {
      description += ` ${income.effect}`;
    }

    return {
      rolls,
      total,
      multiplier,
      addition,
      credits,
      description
    };
  },

  // Recruitment rules - determines recruitment benefits
  resolveRecruit(territory) {
    // Check if territory has recruitment configuration
    if (!territory.recruit) {
      return {
        rolls: null,
        count: 0,
        description: "No recruit benefit."
      };
    }

    try {
      const recruit = territory.recruit;
      const diceCount = recruit.count || 1;
      const diceSides = recruit.sides || 6;
      const targetValue = recruit.target || 6;

      // Roll the specified dice
      const rolls = Dice.rollMany(diceCount, null, diceSides);

      // Count how many dice match the target value
      const matchCount = Dice.countValue(rolls, targetValue);

      // Look up the outcome based on match count
      const outcomes = recruit.outcomes || {};
      const outcomeKey = matchCount.toString();
      const outcome = outcomes[outcomeKey] || "No result defined for this roll.";

      let description = `Rolled ${diceCount}d${diceSides}: ${rolls.join(', ')}. ${matchCount} matching ${targetValue}(s). ${outcome}`;
      
      // Add any additional effect text if provided
      if (recruit.effect) {
        description += ` ${recruit.effect}`;
      }

      return {
        rolls,
        target: targetValue,
        matchCount,
        outcome,
        description
      };
    } catch (error) {
      console.error("Error in resolveRecruit:", error);
      return {
        rolls: null,
        count: 0,
        description: `Error processing recruitment: ${error.message}`
      };
    }
  },

  // Add more rule functions as needed:
  // resolveSpecial(territory) { ... }
  // resolveProduction(territory) { ... }
  // resolveEvent(territory) { ... }
};
