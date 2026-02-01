// -----------------------------
// Dice Helpers
// -----------------------------

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollND6(n) {
  let rolls = [];
  for (let i = 0; i < n; i++) {
    rolls.push(rollD6());
  }
  return rolls;
}

// -----------------------------
// Territory Rules
// -----------------------------

const territoryRules = {
  "Settlement": () => {
    // Income roll
    const incomeRoll = rollD6();
    const income = incomeRoll * 10;

    // Recruitment roll (2D6)
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
  },

  "Gambling Den": () => {
    return {
      type: "Gambling Den",
      income: rollD6()
    };
  },

  "Mine Workings": () => {
    return {
      type: "Mine Workings",
      income: rollD6() * 10
    };
  },

  "Generatorium": () => {
    return {
      type: "Generatorium",
      income: rollD6() * 15
    };
  },

  "Slag Furnace": () => {
    return {
      type: "Slag Furnace",
      income: rollD6() * 20
    };
  }
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
