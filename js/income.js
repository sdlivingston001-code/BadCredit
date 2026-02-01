// Rules for each territory
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
      incomeRoll,
      income,
      recruitRolls,
      recruitment
    };
  },

  "Gambling Den": () => rollD6(),
  "Mine Workings": () => rollD6() * 10,
  "Generatorium": () => rollD6() * 15,
  "Slag Furnace": () => rollD6() * 20
};


// Basic D6 roller
function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

// Multiple D6 roller
function rollND6(n) {
  let rolls = [];
  for (let i = 0; i < n; i++) {
    rolls.push(rollD6());
  }
  return rolls;
}


// Generate income for selected territories
function generateIncome() {
  const selected = [...document.querySelectorAll("input[type=checkbox]:checked")];
  const log = document.getElementById("log");

  selected.forEach(t => {
    const roll = rollD6();
    const income = territoryRules[t.value]();

    const entry = document.createElement("li");
    entry.textContent = `${t.value}: Rolled ${roll} → ${income} credits`;
    log.appendChild(entry);
  });
}

// Clear log
function clearLog() {
  document.getElementById("log").innerHTML = "";
}
