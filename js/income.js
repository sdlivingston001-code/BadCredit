// Income rules for each territory
const territoryRules = {
  "Settlement": () => rollD6() * 10,
  "Gambling Den": () => rollD6(), // adjust later if you want special rules
  "Mine Workings": () => rollD6() * 10,
  "Generatorium": () => rollD6() * 15,
  "Slag Furnace": () => rollD6() * 20
};

// Basic D6 roller
function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
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
