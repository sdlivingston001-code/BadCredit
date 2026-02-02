// dice.js

const Dice = {
  d6() {
    return Math.floor(Math.random() * 6) + 1;
  },

  // Handy extras if you want them later
  d(n) {
    return Math.floor(Math.random() * n) + 1;
  },

  rollMany(n, sides = 6) {
    const rolls = [];
    for (let i = 0; i < n; i++) {
      rolls.push(this.d(sides));
    }
    return rolls;
  }
};
