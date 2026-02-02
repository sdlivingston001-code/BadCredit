// assets/js/territoriesInterface.js

import { loadTerritories, resolveTerritory } from './territoryEngine.js';

let territories = {};

// Load territories on page load
export async function initTerritoriesInterface() {
  territories = await loadTerritories();
  populateTerritoryDropdown();
}

// Populate a <select> element with territory names
function populateTerritoryDropdown() {
  const select = document.getElementById("territorySelect");
  if (!select) return;

  Object.keys(territories).forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = territories[key].type;
    select.appendChild(option);
  });
}

// Run the selected territory's rules
export function runTerritory() {
  const select = document.getElementById("territorySelect");
  const output = document.getElementById("territoryOutput");

  if (!select || !output) return;

  const key = select.value;
  const territory = territories[key];

  const result = resolveTerritory(territory);

  output.innerHTML = formatResult(result);
}

// Format the result into HTML
function formatResult(result) {
  let html = `
    <h3>${result.type}</h3>
    <p><strong>Income Roll:</strong> ${result.roll}</p>
    <p><strong>Income:</strong> ${result.income}</p>
  `;

  if (result.recruitment) {
    html += `
      <p><strong>Recruitment Rolls:</strong> ${result.rolls.join(", ")}</p>
      <p><strong>Outcome:</strong> ${result.recruitment}</p>
    `;
  }

  return html;
}
