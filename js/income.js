// -----------------------------
// Territory Rules
// -----------------------------

import { settlementRule } from "./territories/settlement.js";
import { gamblingdenRule } from "./territories/gambling-den.js";

// -----------------------------
// Dice Helpers
// -----------------------------

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollNDice(n, sides) {
  let rolls = [];
  for (let i = 0; i < n; i++) {
    rolls.push(rollDie(sides));
  }
  return rolls;
}

// -----------------------------
// Territory Rule Map
// -----------------------------

const territoryRules = {
  "Settlement": () => settlementRule(rollDie, rollNDice),
  "Gambling Den": () => gamblingDenRule(rollDie),
  // etc...
};


// -----------------------------
// Main Generator Logic
// -----------------------------

function generateIncome() {
  const selected = [...document.querySelectorAll("input[type=checkbox]:checked")];
  const log = document.getElementById("log");

  selected.forEach(t => {
    const result = territoryRules[t.value]();
    const entry = document.createElement("li");

    if (result.type === "Settlement") {
      entry.innerHTML = `
        <strong>Settlement</strong><br>
        Income Roll: ${result.incomeRoll} → ${result.income} credits<br>
        Recruitment Roll: ${result.recruitRolls.join(", ")} → ${result.recruitment}
      `;
    } else {
      entry.innerHTML = `
        <strong>${result.type}</strong><br>
        Income: ${result.income} credits
      `;
    }

    log.appendChild(entry);
  });
}

// -----------------------------
// Clear Log
// -----------------------------

function clearLog() {
  document.getElementById("log").innerHTML = "";
}
