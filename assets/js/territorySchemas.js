// territorySchemas.js
// Schema definitions for territory rules and gang-specific modifiers

const TerritorySchemas = {
  // Base defaults - these are the foundation
  baseDefaults: {
    income: {
      count: 1,
      sides: 6,
      multiplier: 10,
      addition: 0
    },
    recruit: {
      count: 2,
      sides: 6,
      target: 6,
      outcomes: {
        "0": "No new recruits.",
        "1": "Recruit a juve for free.",
        "2": "Recruit either two juves or one ganger for free."
      }
    }
  },

  // Income schema types - only define what's different from base
  incomeSchemas: {
    
    // Standard income: Uses all base defaults (1d6 x10 + )
    standard: {},
    
    // With disaster event on duplicates
    withDuplicateEvent: {
      count: 2, //By definition there must be at least 2 to allow for duplicates
      event: {
        trigger: "hasDuplicates"
      }
    },

    // User-defined count: Player chooses how many dice to roll
    userDefinedNumber: {
      count_min: 0,
      count_max: 100
    },
  
    // Deck-based income (gambling den)
    deckBased: {
      draw_from_deck: 1
    }
  },

  // Random recruit schema types
  recruitSchemas: {
    // Standard recruit: Uses all base defaults (2d6, target 6)
    standard: {}
  },

  // Helper: Get income schema by name
  getIncomeSchema(schemaName) {
    return this.incomeSchemas[schemaName] || {};
  },

  // Helper: Get recruit schema by name
  getRecruitSchema(schemaName) {
    return this.recruitSchemas[schemaName] || {};
  },

  // Main resolver: Apply schema to territory property
  resolveProperty(property, schemaType = 'income') {
    if (!property) return null;
    
    // Get base defaults
    const baseDefaults = schemaType === 'income' 
      ? this.baseDefaults.income
      : this.baseDefaults.recruit;
    
    // If property has a schema reference, merge base defaults -> schema -> property
    if (property.schema) {
      const schemaDefaults = schemaType === 'income' 
        ? this.getIncomeSchema(property.schema)
        : this.getRecruitSchema(property.schema);
      
      // Three-way merge: base -> schema -> property overrides
      return { ...baseDefaults, ...schemaDefaults, ...property };
    }
    
    // Always merge base defaults, even without a schema reference
    return { ...baseDefaults, ...property };
  },

  // Resolve a complete territory with gang context
  resolveTerritory(territory, gangId = null) {
    let resolved = { ...territory };
    
    // Resolve income schema
    if (resolved.income) {
      resolved.income = this.resolveProperty(resolved.income, 'income');
    }
    
    // Resolve recruit schema
    if (resolved.random_recruit) {
      resolved.random_recruit = this.resolveProperty(resolved.random_recruit, 'recruit');
    }
    
    // Apply gang-specific property overrides using _gangId suffix pattern
    if (gangId) {
      const gangSuffix = `_${gangId}`;
      
      // Handle income override with schema resolution
      if (resolved[`income${gangSuffix}`]) {
        resolved.income = this.resolveProperty(resolved[`income${gangSuffix}`], 'income');
      }
      
      // Handle recruit override with schema resolution
      if (resolved[`random_recruit${gangSuffix}`]) {
        resolved.random_recruit = this.resolveProperty(resolved[`random_recruit${gangSuffix}`], 'recruit');
      }
      
      // Handle simple property overrides (no schema resolution needed)
      ['reputation', 'battle_special_rules', 'fixed_recruit', 'fixed_gear'].forEach(prop => {
        const gangProp = `${prop}${gangSuffix}`;
        if (resolved[gangProp]) {
          resolved[prop] = resolved[gangProp];
        }
      });
    }
    
    return resolved;
  },

  // Validate territory against schema
  validateTerritory(territory) {
    const errors = [];
    
    // Basic validation
    if (!territory.name) {
      errors.push(`Territory ${territory.id} missing name`);
    }
    
    if (!territory.level) {
      errors.push(`Territory ${territory.id} missing level`);
    }
    
    // Validate income schema if present
    if (territory.income && territory.income.schema) {
      if (!this.incomeSchemas[territory.income.schema]) {
        errors.push(`Territory ${territory.id} references unknown income schema: ${territory.income.schema}`);
      }
    }
    
    // Validate recruit schema if present
    if (territory.random_recruit && territory.random_recruit.schema) {
      if (!this.recruitSchemas[territory.random_recruit.schema]) {
        errors.push(`Territory ${territory.id} references unknown recruit schema: ${territory.random_recruit.schema}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Validate all territories
  validateAll(territories) {
    const allErrors = [];
    
    territories.forEach(territory => {
      const { valid, errors } = this.validateTerritory(territory);
      if (!valid) {
        allErrors.push(...errors);
      }
    });
    
    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }
};
