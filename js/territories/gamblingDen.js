export function gamblingDenRule(rollDie) {
  return {
    type: "Gambling Den",
    income: rollDie(6) * 10
  };
}
