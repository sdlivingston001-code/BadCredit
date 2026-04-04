/**
 * postBattleEngine.js — Business logic for the Post-Battle sequence.
 *
 * Provides two simple dice tests:
 *   - Succumb Test:  D6, on 1–2 the fighter suffers a Lasting Injury.
 *   - Escape Test:   D6 + modifier.  Passes on a natural 6 or total ≥ 4.
 *     Modifiers: Draw (−1), Lost (−2), Webbed (−2), Skinblade (+2).
 *
 * Lasting injury resolution, Rogue Doc treatment, and mutation tests
 * reuse LastingInjuriesEngine rather than duplicating logic here.
 *
 * Depends on: dice.js (Dice)
 */

import { Dice } from './dice.js';

export const PostBattleEngine = {

  /**
   * Roll 1D6. On a 1 or 2 the fighter suffers a Lasting Injury.
   * @returns {{ roll: number, succumbed: boolean }}
   */
  rollSuccumb() {
    const roll = Dice.d(6);
    return { roll, succumbed: roll <= 2 };
  },

  /**
   * Roll an escape test for a captured fighter.
   * @param {number} modifier - Sum of checked condition modifiers.
   * @returns {{ roll: number, modifier: number, total: number, natural6: boolean, escaped: boolean }}
   */
  rollEscape(modifier) {
    const roll = Dice.d(6);
    const total = roll + modifier;
    const natural6 = roll === 6;
    const escaped = natural6 || total >= 4;
    return { roll, modifier, total, natural6, escaped };
  },

};
