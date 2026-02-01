// -----------------------------
// Territory Rules
// -----------------------------

import { settlementRule } from ".archive/territories/settlement.js";
import { gamblingDenRule } from ".archive/territories/gamblingDen.js";

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
  const start = new Date();
  const log = document.getElementById("log");

  try {
    const selected = [...document.querySelectorAll("input[type=checkbox]:checked")];

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

      log.prepend(entry);
    });

  } catch (err) {
    // This logs the error visibly in the UI
    const errorEntry = document.createElement("li");
    errorEntry.innerHTML = `
      <strong style="color:red;">Error:</strong> ${err.message}
    `;
    log.prepend(errorEntry);

  } finally {
    // This ALWAYS runs, even if an error occurred
    const end = new Date();
    const timeEntry = document.createElement("li");
    timeEntry.innerHTML = `
      <em>Started:</em> ${start.toLocaleTimeString()}<br>
      <em>Finished:</em> ${end.toLocaleTimeString()}
    `;
    log.prepend(timeEntry);
  }
}

// -----------------------------
// Clear Log
// -----------------------------

function clearLog() {
  document.getElementById("log").innerHTML = "";
}

// -----------------------------
// Expose functions to browser
// -----------------------------

window.generateIncome = generateIncome;
window.clearLog = clearLog;
