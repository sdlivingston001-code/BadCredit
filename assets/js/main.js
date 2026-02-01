import { loadTerritories, resolveTerritory } from './territoryEngine.js';

const territories = await loadTerritories();

const result = resolveTerritory(territories.gamblingDen);
console.log(result);
