// scavengedWeaponsEngine.js

const ScavengedWeaponsEngine = {
  data: null,

  loadData(data) {
    this.data = data;
  },

  roll() {
    const table = this.data && this.data.scavenged_weapon_roll;
    if (!table) return { error: 'Data not loaded.' };

    const rolls = Dice.rollMany(table.count, null, table.sides);
    const total = Dice.sum(rolls);
    const result = this.findResult(total);

    if (!result) return { rolls, total, error: `No result found for roll ${total}.` };

    return { rolls, total, result };
  },

  findResult(roll) {
    const table = this.data && this.data.scavenged_weapon_roll;
    if (!table || !table.results) return null;

    for (const [id, entry] of Object.entries(table.results)) {
      if (this.isInRange(roll, entry.values)) {
        return { id, ...entry };
      }
    }
    return null;
  },

  isInRange(roll, values) {
    for (const value of values) {
      if (typeof value === 'number') {
        if (roll === value) return true;
      } else if (typeof value === 'string' && value.includes('-')) {
        const [min, max] = value.split('-').map(Number);
        if (roll >= min && roll <= max) return true;
      } else {
        if (roll === Number(value)) return true;
      }
    }
    return false;
  }
};