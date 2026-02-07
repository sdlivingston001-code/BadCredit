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
  },

  // Check if an array of dice rolls contains any duplicate values
  hasDuplicates(rolls) {
    const seen = new Set();
    for (const roll of rolls) {
      if (seen.has(roll)) {
        return true;
      }
      seen.add(roll);
    }
    return false;
  },

  // Draw cards from a 54-card deck (52 standard + 2 jokers)
  // Returns array of card objects with rank, suit, value, and display
  // Set Dice.forceJoker = true to always draw jokers (for testing)
  drawCards(count = 1) {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const values = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // Ace=14, face cards=11,12,13
    const suitColors = { '♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black' };
    
    // Build full deck: 52 regular cards + 2 jokers
    const fullDeck = [];
    for (const suit of suits) {
      for (let i = 0; i < ranks.length; i++) {
        const color = suitColors[suit];
        fullDeck.push({
          rank: ranks[i],
          suit: suit,
          value: values[i],
          display: `${ranks[i]}<span style="color: ${color};">${suit}</span>`
        });
      }
    }
    // Add two jokers with value 0
    const joker = { rank: 'Joker', suit: '🃏', value: 0, display: 'a <span style="color: #9c27b0; font-weight: bold;">🎭 JOKER</span>' };
    fullDeck.push(joker);
    fullDeck.push({ rank: 'Joker', suit: '🃏', value: 0, display: 'a <span style="color: #9c27b0; font-weight: bold;">🎭 JOKER</span>' });
    
    // Testing: force joker draw
    if (this.forceJoker) {
      return Array(count).fill(joker);
    }
    
    // Draw random cards from deck
    const cards = [];
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * fullDeck.length);
      cards.push(fullDeck[randomIndex]);
    }
    return cards;
  }
};