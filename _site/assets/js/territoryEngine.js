// territoryEngine.js

// TerritoryEngine handles all territory-related rules and calculations

const TerritoryEngine = {
  // Resolve territory with schema before processing
  // This applies schema defaults and gang-specific modifiers
  resolveWithSchema(territory, selectedGang) {
    if (typeof TerritorySchemas !== 'undefined') {
      return TerritorySchemas.resolveTerritory(territory, selectedGang);
    }
    // Fallback to original territory if schemas not loaded
    return territory;
  },

  // Helper: Get gang-specific property or fall back to base property
  // NOTE: This is now primarily handled by schema resolution, but kept for backward compatibility
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
    const value = territory[propertyName];  // Schema layer already applied gang overrides
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

    // Resolve all territories with schema before processing
    const resolvedTerritories = territories.map(territory => 
      this.resolveWithSchema(territory, selectedGang)
    );

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
        resolvedTerritories, property, resolver, selectedGang, userInputCounts
      );
      processedRules[name] = { results, territoriesWithout };
      
      // Collect events from income results
      if (name === 'income') {
        results.forEach((item, index) => {
          if (item.result.eventTriggered) {
            territoriesWithEvents.push({
              id: resolvedTerritories[index].id,
              name: resolvedTerritories[index].name || resolvedTerritories[index].id,
              description: item.result.eventText || item.result.description
            });
          }
        });
      }
    });

    // Combine all results by territory
    return {
      territories: resolvedTerritories.map((territory, index) => ({
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
  resolve_income(territory, selectedGang, userInput) {
    const income = territory.income;  // Schema layer already applied gang overrides
    
    if (!income) {
      return { roll: null, credits: 0, description: null };
    }

    // Handle deck-based income (gambling den)
    if (income.draw_from_deck) {
      return this.resolve_deckIncome(income, userInput);
    }

    // Schema layer provides all defaults, just destructure
    const { multiplier, sides, addition, count_min, count_max, count_multiplier = 1 } = income;
    
    // userInput is the count for dice-based income
    const userCount = userInput;
    
    // Determine dice count
    const count = (count_min !== undefined && count_max !== undefined) 
      ? userCount 
      : income.count;
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
    
    const credits = total * effectiveMultiplier + effectiveAddition;

    // Build description
    const sortedRolls = [...rolls].sort((a, b) => a - b);
    const calculationPart = this.formatCalculation(effectiveMultiplier, total, effectiveAddition);
    const description = `Rolled ${count}d${sides}${countDescription}: ${sortedRolls.join('+')} = ${total}. Income: ${calculationPart} = ${credits} credits.`;
    
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
      return `(${total} × ${multiplier}) + ${addition}`;
    } else if (multiplier !== 1) {
      return `${total} × ${multiplier}`;
    } else if (addition !== 0) {
      return `${total} + ${addition}`;
    }
    return `${total}`;
  },

  // Deck-based income (gambling den)
  resolve_deckIncome(income, guessedSuit) {
    const card = Dice.drawCards(1)[0];
    const suitColors = {
      '♠': 'black', '♣': 'black',
      '♥': 'red', '♦': 'red'
    };
    
    const cardColor = suitColors[card.suit];
    const guessedColor = suitColors[guessedSuit];
    
    let multiplier = 0;
    let outcome = '';
    
    if (card.suit === guessedSuit) {
      multiplier = 10;
      outcome = '✓ Correct suit!';
    } else if (cardColor === guessedColor) {
      multiplier = 5;
      outcome = '~ Correct color, wrong suit';
    } else {
      multiplier = 0;
      outcome = '✗ Wrong color and suit';
    }
    
    const credits = card.value * multiplier;
    const description = `Drew ${card.display}. Guessed ${guessedSuit}. ${outcome} Income: ${card.value} × ${multiplier} = ${credits} credits.`;
    
    return {
      card: card.display,
      cardValue: card.value,
      guessedSuit,
      outcome,
      multiplier,
      credits,
      description
    };
  },

  // Randomised recruitment rules
  resolve_randomrecruit(territory, selectedGang) {
    const recruit = territory.random_recruit;  // Schema layer already applied gang overrides
    
    if (!recruit) {
      return { rolls: null, count: 0, description: null };
    }

    try {
      // Schema layer provides all defaults, just destructure
      const { count, sides, target, outcomes, effect } = recruit;

      const rolls = Dice.rollMany(count, null, sides);
      const matchCount = Dice.countValue(rolls, target);
      const outcome = outcomes[matchCount.toString()] || "No result defined for this roll.";

      let description = `Rolled ${count}d${sides}: ${rolls.join('+')}. ${matchCount} matching ${target}(s). ${outcome}`;
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
