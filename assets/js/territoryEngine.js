// territoryEngine.js

// TerritoryEngine expects an array of full territory objects:
// [{ id, name, type, income, ... }, ...]

const TerritoryEngine = {
  resolve(territories) {
    if (!Array.isArray(territories)) return [];

    return territories.map(territory => {
      const roll = Dice.d6();
      const effect = this.applyRules(territory, roll);

      return {
        id: territory.id,
        territory,
        roll,
        effect
      };
    });
  },

  // This is where you encode Dominion / BadCredit‑specific rules.
  // You can branch on territory.type, tags, income, etc.
  applyRules(territory, roll) {
    // Example scaffolding – tweak to match your actual rules.
    // You can expand this with a big switch or lookup table.

    // Simple example:
    // - On 1–2: no effect
    // - On 3–4: base income
    // - On 5–6: boosted income

    const baseIncome = territory.income || 0;

    if (roll <= 2) {
      return "No effect this cycle.";
    } else if (roll <= 4) {
      return `Gain ${baseIncome} credits.`;
    } else {
      const boosted = baseIncome + Math.ceil(baseIncome * 0.5);
      return `Great haul! Gain ${boosted} credits.`;
    }
  }
};
