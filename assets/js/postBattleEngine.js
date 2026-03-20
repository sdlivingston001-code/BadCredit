// postBattleEngine.js

const PostBattleEngine = {

  // Roll 1D6. On a 1 or 2 the fighter suffers a Lasting Injury.
  rollSuccumb() {
    const roll = Dice.d(6);
    return { roll, succumbed: roll <= 2 };
  },

  // Roll escape test. Modifier is the sum of checked conditions.
  // Passes on natural 6, or total (roll + modifier) >= 4.
  rollEscape(modifier) {
    const roll = Dice.d(6);
    const total = roll + modifier;
    const natural6 = roll === 6;
    const escaped = natural6 || total >= 4;
    return { roll, modifier, total, natural6, escaped };
  },

};
