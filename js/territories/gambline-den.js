export function gamblingDenRule(rollD6) {
  return {
    type: "Gambling Den",
    income: rollD6()
  };
}
