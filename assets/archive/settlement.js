export function settlementRule(rollDie, rollNDice) {
  const incomeRoll = rollDie(6);
  const income = incomeRoll * 10;

  const recruitRolls = rollNDice(2,6);
  const sixes = recruitRolls.filter(r => r === 6).length;

  let recruitment = "No new recruits";

  if (sixes === 2) {
    recruitment = "Recruit a ganger OR two juves";
  } else if (sixes === 1) {
    recruitment = "Recruit a juve";
  }

  return {
    type: "Settlement",
    incomeRoll,
    income,
    recruitRolls,
    recruitment
  };
}
