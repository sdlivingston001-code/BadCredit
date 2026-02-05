// territoryEngine.js

// TerritoryEngine handles all territory-related rules and calculations

const TerritoryEngine = {
  // Helper: Get gang-specific property or fall back to base property
  getPropertyWithGangOverride(territory, propertyName, selectedGang) {
    if (selectedGang) {
      const gangKey = `${propertyName}_${selectedGang}`;
      if (territory[gangKey]) {
        return territory[gangKey];
      }
    }
    return territory[propertyName];
  },

  // Helper: Resolve a simple text-based rule (reputation, fixed gear, etc.)
  resolveSimpleRule(territory, propertyName, selectedGang) {
    const value = this.getPropertyWithGangOverride(territory, propertyName, selectedGang);
    return {
      description: value || null
    };
  },

  // Helper: Process a single rule type across all territories
  processRuleType(territories, propertyName, resolveFunction, selectedGang, userInputCounts = {}) {
    const results = [];
    const territoriesWithout = [];
    
    territories.forEach(territory => {
      const hasProperty = territory[propertyName] || 
        (selectedGang && territory[`${propertyName}_${selectedGang}`]);
      
      if (!hasProperty) {
        territoriesWithout.push(territory.name || territory.id);
      }
      
      const result = resolveFunction.call(this, territory, selectedGang, userInputCounts[territory.id]);
      results.push({ id: territory.id, result });
    });
    
    return { results, territoriesWithout };
  },
  // Event trigger test functions
  eventTriggers: {
    hasDuplicates: (rolls) => Dice.hasDuplicates(rolls),
    // Add more trigger functions as needed
    // allSameValue: (rolls) => rolls.every(r => r === rolls[0]),
    // containsValue: (rolls, value) => rolls.includes(value),
  },

  // Main function that processes all territories and applies all rules
  resolve_all(territories, userInputCounts = {}, selectedGang = null) {
    if (!Array.isArray(territories)) return [];

    const territoriesWithEvents = [];
    const ruleTypes = [
      { name: 'income', property: 'income', resolver: this.resolve_income },
      { name: 'recruit', property: 'random_recruit', resolver: this.resolve_randomrecruit },
      { name: 'fixedRecruit', property: 'fixed_recruit', resolver: this.resolve_fixedrecruit },
      { name: 'reputation', property: 'reputation', resolver: this.resolve_reputation },
      { name: 'fixedGear', property: 'fixed_gear', resolver: this.resolve_fixedgear },
      { name: 'battleSpecialRules', property: 'battle_special_rules', resolver: this.resolve_battlespecialrules },
      { name: 'scenarioSelectionSpecialRules', property: 'scenario_selection_special_rules', resolver: this.resolve_scenarioselectionspecialrules }
    ];

    // Process all rule types
    const processedRules = {};
    ruleTypes.forEach(({ name, property, resolver }) => {
      const { results, territoriesWithout } = this.processRuleType(
        territories, property, resolver, selectedGang, userInputCounts
      );
      processedRules[name] = { results, territoriesWithout };
      
      // Collect events from income results
      if (name === 'income') {
        results.forEach((item, index) => {
          if (item.result.eventTriggered) {
            territoriesWithEvents.push({
              id: territories[index].id,
              name: territories[index].name || territories[index].id,
              description: item.result.eventText || item.result.description
            });
          }
        });
      }
    });

    // Combine all results by territory
    return {
      territories: territories.map((territory, index) => ({
        id: territory.id,
        territory,
        ...Object.fromEntries(
          ruleTypes.map(({ name }) => [name, processedRules[name].results[index].result])
        )
      })),
      ...Object.fromEntries(
        ruleTypes.map(({ name, property }) => [
          `territoriesWithout${name.charAt(0).toUpperCase() + name.slice(1)}`,
          processedRules[name].territoriesWithout
        ])
      ),
      territoriesWithEvents
    };
  },

  // Income rules - determines credits earned from a territory
  resolve_income(territory, selectedGang, userCount) {
    const income = this.getPropertyWithGangOverride(territory, 'income', selectedGang);
    
    if (!income) {
      return { roll: null, credits: 0, description: null };
    }

    const { multiplier = 0, sides = 6, addition = 0, count_min, count_max, count_multiplier = 1 } = income;
    
    // Determine dice count
    const count = (count_min !== undefined && count_max !== undefined) 
      ? userCount 
      : (income.count || 1);
    const countDescription = (count_min !== undefined && count_max !== undefined)
      ? (count_multiplier > 1 ? ` (user selected ${userCount / count_multiplier}, x${count_multiplier} = ${count})` : ` (user selected ${count})`)
      : '';

    // Roll dice
    const rolls = Dice.rollMany(count, null, sides);
    const total = rolls.reduce((sum, roll) => sum + roll, 0);
    
    // Check for events and apply overrides
    const eventTriggered = income.event?.trigger && 
      this.eventTriggers[income.event.trigger] && 
      this.eventTriggers[income.event.trigger](rolls);
    const effectiveMultiplier = eventTriggered && income.event.multiplier !== undefined
      ? income.event.multiplier
      : multiplier;
    const effectiveAddition = eventTriggered && income.event.addition !== undefined
      ? income.event.addition
      : addition;
    
    const credits = effectiveMultiplier * total + effectiveAddition;

    // Build description
    const sortedRolls = [...rolls].sort((a, b) => a - b);
    const calculationPart = this.formatCalculation(effectiveMultiplier, total, effectiveAddition);
    const description = `Rolled ${count}d${sides}${countDescription}: ${sortedRolls.join(', ')} = ${total}. Income: ${calculationPart} = ${credits} credits.`;
    
    return {
      rolls,
      total,
      multiplier,
      addition,
      credits,
      description,
      eventTriggered,
      eventTrigger: eventTriggered ? income.event.trigger : null,
      eventText: eventTriggered && income.event.text ? income.event.text : null
    };
  },

  // Helper: Format calculation display
  formatCalculation(multiplier, total, addition) {
    if (multiplier !== 1 && addition !== 0) {
      return `(${multiplier} × ${total}) + ${addition}`;
    } else if (multiplier !== 1) {
      return `${multiplier} × ${total}`;
    } else if (addition !== 0) {
      return `${total} + ${addition}`;
    }
    return `${total}`;
  },

  // Randomised recruitment rules
  resolve_randomrecruit(territory, selectedGang) {
    const recruit = this.getPropertyWithGangOverride(territory, 'random_recruit', selectedGang);
    
    if (!recruit) {
      return { rolls: null, count: 0, description: null };
    }

    try {
      const { count = 1, sides = 6, target = 6, outcomes = {}, effect } = recruit;

      const rolls = Dice.rollMany(count, null, sides);
      const matchCount = Dice.countValue(rolls, target);
      const outcome = outcomes[matchCount.toString()] || "No result defined for this roll.";

      let description = `Rolled ${count}d${sides}: ${rolls.join(', ')}. ${matchCount} matching ${target}(s). ${outcome}`;
      if (effect) {
        description += ` ${effect}`;
      }

      return { rolls, target, matchCount, outcome, description };
    } catch (error) {
      console.error("Error in resolveRecruit:", error);
      return {
        rolls: null,
        count: 0,
        description: `Error processing recruitment: ${error.message}`
      };
    }
  },

  // Simple text-based rules (all follow the same pattern)
  resolve_fixedrecruit(territory, selectedGang) {
    return this.resolveSimpleRule(territory, 'fixed_recruit', selectedGang);
  },

  resolve_reputation(territory, selectedGang) {
    return this.resolveSimpleRule(territory, 'reputation', selectedGang);
  },

  resolve_fixedgear(territory, selectedGang) {
    return this.resolveSimpleRule(territory, 'fixed_gear', selectedGang);
  },

  resolve_battlespecialrules(territory, selectedGang) {
    return this.resolveSimpleRule(territory, 'battle_special_rules', selectedGang);
  },

  resolve_scenarioselectionspecialrules(territory, selectedGang) {
    return this.resolveSimpleRule(territory, 'scenario_selection_special_rules', selectedGang);
  }
};
