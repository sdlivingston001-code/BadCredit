// territoryEngine.js

// TerritoryEngine handles all territory-related rules and calculations

const TerritoryEngine = {
  // Main function that processes all territories and applies all rules
  // Processes by rule type: all income rolls first, then all recruit rolls, etc.
  resolve_all(territories, userInputCounts = {}, selectedGang = null) {
    if (!Array.isArray(territories)) return [];

    // Track territories without rules
    const territoriesWithoutIncome = [];
    const territoriesWithoutRecruit = [];
    const territoriesWithoutFixedRecruit = [];
    const territoriesWithoutReputation = [];
    const territoriesWithoutFixedGear = [];
    const territoriesWithoutBattleSpecialRules = [];
    const territoriesWithoutScenarioSelectionSpecialRules = [];
    const territoriesWithNilEvents = [];

    // First, do all income rolls
    const incomeResults = territories.map(territory => {
      const userCount = userInputCounts[territory.id];
      const result = this.resolve_income(territory, userCount, selectedGang);
      if (!territory.income) {
        territoriesWithoutIncome.push(territory.name || territory.id);
      }
      if (result.nilEventTriggered) {
        territoriesWithNilEvents.push({
          id: territory.id,
          name: territory.name || territory.id,
          description: result.description
        });
      }
      return {
        id: territory.id,
        result
      };
    });

    // Then, do all recruit rolls
    const recruitResults = territories.map(territory => {
      const result = this.resolve_randomrecruit(territory);
      if (!territory.random_recruit) {
        territoriesWithoutRecruit.push(territory.name || territory.id);
      }
      return {
        id: territory.id,
        result
      };
    });

    // Then, do all fixed recruit checks
    const fixedRecruitResults = territories.map(territory => {
      const result = this.resolve_fixedrecruit(territory);
      if (!territory.fixed_recruit) {
        territoriesWithoutFixedRecruit.push(territory.name || territory.id);
      }
      return {
        id: territory.id,
        result
      };
    });

    // Then, do all reputation checks
    const reputationResults = territories.map(territory => {
      const result = this.resolve_reputation(territory);
      if (!territory.reputation) {
        territoriesWithoutReputation.push(territory.name || territory.id);
      }
      return {
        id: territory.id,
        result
      };
    });

    // Then, do all fixed gear checks
    const fixedGearResults = territories.map(territory => {
      const result = this.resolve_fixedgear(territory);
      if (!territory.fixed_gear) {
        territoriesWithoutFixedGear.push(territory.name || territory.id);
      }
      return {
        id: territory.id,
        result
      };
    });

    // Then, do all battle special rules checks
    const battleSpecialRulesResults = territories.map(territory => {
      const result = this.resolve_battlespecialrules(territory);
      if (!territory.battle_special_rules) {
        territoriesWithoutBattleSpecialRules.push(territory.name || territory.id);
      }
      return {
        id: territory.id,
        result
      };
    });

    // Then, do all scenario selection special rules checks
    const scenarioSelectionSpecialRulesResults = territories.map(territory => {
      const result = this.resolve_scenarioselectionspecialrules(territory);
      if (!territory.scenario_selection_special_rules) {
        territoriesWithoutScenarioSelectionSpecialRules.push(territory.name || territory.id);
      }
      return {
        id: territory.id,
        result
      };
    });

    // Add more rule types here as needed
    // const specialResults = territories.map(territory => ({
    //   id: territory.id,
    //   result: this.resolveSpecial(territory)
    // }));

    // Combine all results by territory
    return {
      territories: territories.map((territory, index) => ({
        id: territory.id,
        territory,
        income: incomeResults[index].result,
        recruit: recruitResults[index].result,
        fixedRecruit: fixedRecruitResults[index].result,
        reputation: reputationResults[index].result,
        fixedGear: fixedGearResults[index].result,
        battleSpecialRules: battleSpecialRulesResults[index].result,
        scenarioSelectionSpecialRules: scenarioSelectionSpecialRulesResults[index].result
      })),
      territoriesWithoutIncome,
      territoriesWithoutRecruit,
      territoriesWithoutFixedRecruit,
      territoriesWithoutReputation,
      territoriesWithoutFixedGear,
      territoriesWithoutBattleSpecialRules,
      territoriesWithoutScenarioSelectionSpecialRules,
      territoriesWithNilEvents
    };
  },

  // Income rules - determines credits earned from a territory
  resolve_income(territory, userCount, selectedGang) {
    // Check for gang-specific variant first, then fall back to base income
    let income = territory.income;
    if (selectedGang) {
      const gangKey = `income_${selectedGang.toLowerCase().replace(/\s+/g, '_')}`;
      if (territory[gangKey]) {
        income = territory[gangKey];
      }
    }
    
    // Check if territory has income configuration
    if (!income) {
      return {
        roll: null,
        credits: 0,
        description: null
      };
    }
    const multiplier = income.multiplier || 1;
    const sides = income.sides || 6;
    const addition = income.addition || 0;
    
    // Determine count: use user input for variable range, otherwise use fixed count
    let count;
    let countDescription = '';
    if (income.count_min !== undefined && income.count_max !== undefined) {
      count = userCount;
      countDescription = ` (user selected ${count} from ${income.count_min}-${income.count_max}d${sides})`;
    } else {
      count = income.count || 1;
      countDescription = '';
    }

    // Roll dice based on configuration: multiplier × count × d(sides)
    const rolls = Dice.rollMany(count, null, sides);
    const total = rolls.reduce((sum, roll) => sum + roll, 0);
    
    // Check for duplicates if nil_event is configured as 'hasDuplicates'
    let credits;
    let hasDuplicates = false;
    let nilTextApplied = false;
    
    if (income.nil_event === 'hasDuplicates' && Dice.hasDuplicates(rolls)) {
      credits = 0;
      hasDuplicates = true;
      nilTextApplied = true;
    } else {
      credits = multiplier * total + addition;
    }

    let description;
    if (nilTextApplied) {
      const sortedRolls = [...rolls].sort((a, b) => a - b);
      description = `Rolled ${count}d${sides}${countDescription}: ${sortedRolls.join(', ')}. ${income.nil_text}`;
    } else {
      let calculationPart;
      if (multiplier !== 1 && addition !== 0) {
        calculationPart = `(${multiplier} × ${total}) + ${addition}`;
      } else if (multiplier !== 1) {
        calculationPart = `${multiplier} × ${total}`;
      } else if (addition !== 0) {
        calculationPart = `${total} + ${addition}`;
      } else {
        calculationPart = `${total}`;
      }
      description = `Rolled ${count}d${sides}${countDescription}: ${rolls.join('+')} = ${total}. Income: ${calculationPart} = ${credits} credits.`;
    }
    
    return {
      rolls,
      total,
      multiplier,
      addition,
      credits,
      description,
      nilEventTriggered: nilTextApplied
    };
  },

  // Randomised recruitment rules
  resolve_randomrecruit(territory) {
    // Check if territory has recruitment configuration
    if (!territory.random_recruit) {
      return {
        rolls: null,
        count: 0,
        description: null
      };
    }

    try {
      const recruit = territory.random_recruit;
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

  // Fixed recruitment rules - simple text-based recruitment benefit
  resolve_fixedrecruit(territory) {
    // Check if territory has fixed recruitment configuration
    if (!territory.fixed_recruit) {
      return {
        description: null
      };
    }

    // Return the text description directly
    return {
      description: territory.fixed_recruit
    };
  },

  // Reputation rules - simple text-based reputation benefit/penalty
  resolve_reputation(territory) {
    // Check if territory has reputation configuration
    if (!territory.reputation) {
      return {
        description: null
      };
    }

    // Return the text description directly
    return {
      description: territory.reputation
    };
  },

  // Fixed gear rules - simple text-based gear benefit
  resolve_fixedgear(territory) {
    // Check if territory has fixed gear configuration
    if (!territory.fixed_gear) {
      return {
        description: null
      };
    }

    // Return the text description directly
    return {
      description: territory.fixed_gear
    };
  },

  // Battle special rules - simple text-based special rules for battles
  resolve_battlespecialrules(territory) {
    // Check if territory has battle special rules configuration
    if (!territory.battle_special_rules) {
      return {
        description: null
      };
    }

    // Return the text description directly
    return {
      description: territory.battle_special_rules
    };
  },

  // Scenario selection special rules - simple text-based special rules for scenario selection
  resolve_scenarioselectionspecialrules(territory) {
    // Check if territory has scenario selection special rules configuration
    if (!territory.scenario_selection_special_rules) {
      return {
        description: null
      };
    }

    // Return the text description directly
    return {
      description: territory.scenario_selection_special_rules
    };
  },

  // Add more rule functions as needed:
  // resolveSpecial(territory) { ... }
  // resolveProduction(territory) { ... }
  // resolveEvent(territory) { ... }
};
