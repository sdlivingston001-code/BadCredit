// dice.js

const Dice = {
  d6() {
    return Math.floor(Math.random() * 6) + 1;
  },

  // Handy extras if you want them later
  d(n) {
    return Math.floor(Math.random() * n) + 1;
  },

  d66() {
    return this.d6()*10 + this.d6();
  }

  firepower() {
    const table = {
      1: { shots: 1, jam: false, label: "Single shot" },
      2: { shots: 2, jam: false, label: "Sustained fire (2)" },
      3: { shots: 3, jam: false, label: "Sustained fire (3)" },
      4: { shots: 1, jam: true,  label: "Ammo check!" },
      5: { shots: 1, jam: false, label: "Single shot" },
      6: { shots: 2, jam: false, label: "Sustained fire (2)" }
    };

    const roll = this.d6();
    return { roll, ...table[roll] };
  },

  injury() {
    const table = {
      1: { result: "Flesh wound", effect: -1 },
      2: { result: "Flesh wound", effect: -1 },
      3: { result: "Serious injury", effect: null },
      4: { result: "Serious injury", effect: null },
      5: { result: "Out of action", effect: null },
      6: { result: "Out of action", effect: null }
    };

    const roll = this.d6();
    return { roll, ...table[roll] };
  }
 };
  
  rollMany(n, sides = 6) {
    const rolls = [];
    for (let i = 0; i < n; i++) {
      rolls.push(this.d(sides));
    }
    return rolls;
  }
};
