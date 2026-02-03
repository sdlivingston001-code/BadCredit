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
  },

  d6_firepower() {
    const table = {
      1: { shots: 1, jam: false, label: "One hit"},
      2: { shots: 1, jam: false, label: "One hit"},
      3: { shots: 2, jam: false, label: "Two hits" },
      4: { shots: 2, jam: false, label: "Two hits" },
      5: { shots: 3, jam: false, label: "Three hits" },
      6: { shots: 1, jam: true, label: "One hit and Ammo check" }
    };

    const roll = this.d6();
    return { roll, ...table[roll] };
  },

  d6_injury() {
    const table = {
      1: { result: "Flesh wound"},
      2: { result: "Flesh wound"},
      3: { result: "Serious injury"},
      4: { result: "Serious injury"},
      5: { result: "Serious injury"},
      6: { result: "Out of action"}
    };

    const roll = this.d6();
    return { roll, ...table[roll] };
  },

  //Example usage:
  // Dice.rollMany(3); // rolls three d6 by default
  // Dice.rollMany(2, Dice.d, 8); // rolls two d8
  // Dice.rollMany(3, Dice.d6_firepower); // rolls 3 d6_firepower
  rollMany(n, diceFunc = null, sides = 6) {
    const rolls = [];
    for (let i = 0; i < n; i++) {
      if (diceFunc) {
        rolls.push(diceFunc.call(this));
      } else {
        rolls.push(this.d(sides));
      }
    }
    return rolls;
  },

  countValue(rolls, value) {
    return rolls.filter(roll => roll === value).length;
  }
};