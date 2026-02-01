import { rollDie, rollNDice } from './dice.js';

export async function loadTerritories() {
  const response = await fetch('/data/territories.json');
  return await response.json();
}

export function resolveIncome(territory) {
  const die = territory.income.die;
  const multiplier = territory.income.multiplier;

  const roll = rollDie(die);
  return {
    roll,
    income: roll * multiplier
  };
}

export function resolveRecruitment(territory) {
  if (!territory.recruitment) {
    return { recruitment: null };
  }

  const { count, sides } = territory.recruitment.dice;
  const rolls = rollNDice(count, sides);
  const sixes = rolls.filter(r => r === 6).length;

  let result = territory.recruitment.outcomes["0_sixes"];
  if (sixes === 1) result = territory.recruitment.outcomes["1_six"];
  if (sixes === 2) result = territory.recruitment.outcomes["2_sixes"];

  return {
    rolls,
    sixes,
    recruitment: result
  };
}

export function resolveTerritory(territory) {
  return {
    type: territory.type,
    ...resolveIncome(territory),
    ...resolveRecruitment(territory)
  };
}
