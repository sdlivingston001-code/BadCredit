export function settlementRule(rollD6, rollND6) {
  const incomeRoll = rollD6();
  const income = incomeRoll * 10;

  const recruitRolls = rollND6(2);
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
