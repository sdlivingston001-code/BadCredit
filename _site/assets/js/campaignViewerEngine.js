// campaignViewerEngine.js - Fetch and process Munda Manager campaign data

const CampaignViewerEngine = {
  campaignData: null,
  defaultCampaignId: 'e2785818-5736-4c50-bfb2-d243953541f8',
  campaignIdKey: 'mundamanager_campaign_id',
  apiUrlBase: "https://www.mundamanager.com/api/campaigns/",
  useCorsProxy: true, // Set to false if CORS is fixed on server
  cacheKey: 'mundamanager_campaign_cache',
  cacheTimeKey: 'mundamanager_campaign_cache_time',
  cacheDuration: 15 * 60 * 1000, // 15 minutes in milliseconds

  /**
   * Get the current campaign ID
   * @returns {string}
   */
  getCampaignId() {
    return localStorage.getItem(this.campaignIdKey) || this.defaultCampaignId;
  },

  /**
   * Set the campaign ID
   * @param {string} campaignId
   */
  setCampaignId(campaignId) {
    if (campaignId && campaignId.trim()) {
      localStorage.setItem(this.campaignIdKey, campaignId.trim());
      // Clear cache when campaign ID changes
      localStorage.removeItem(this.cacheKey);
      localStorage.removeItem(this.cacheTimeKey);
      return true;
    }
    return false;
  },

  /**
   * Get the API URL for the current campaign
   * @returns {string}
   */
  getApiUrl() {
    return `${this.apiUrlBase}${this.getCampaignId()}/data`;
  },

  /**
   * Check if cached data is still valid
   * @returns {boolean}
   */
  isCacheValid() {
    const cacheTime = localStorage.getItem(this.cacheTimeKey);
    if (!cacheTime) return false;
    
    const age = Date.now() - parseInt(cacheTime);
    return age < this.cacheDuration;
  },

  /**
   * Get time remaining until next fetch is allowed
   * @returns {number} Milliseconds remaining, or 0 if fetch is allowed
   */
  getTimeUntilNextFetch() {
    const cacheTime = localStorage.getItem(this.cacheTimeKey);
    if (!cacheTime) return 0;
    
    const age = Date.now() - parseInt(cacheTime);
    const remaining = this.cacheDuration - age;
    return remaining > 0 ? remaining : 0;
  },

  /**
   * Get cached data
   * @returns {Object|null}
   */
  getCachedData() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  },

  /**
   * Save data to cache
   * @param {Object} data
   */
  saveToCache(data) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
      localStorage.setItem(this.cacheTimeKey, Date.now().toString());
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  },

  /**
   * Fetch campaign data from the API
   * @param {boolean} forceRefresh - Force fetch even if cache is valid
   * @returns {Promise<Object>} Campaign data or error
   */
  async fetchCampaignData(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this.isCacheValid()) {
      const cached = this.getCachedData();
      if (cached) {
        this.campaignData = cached;
        return { 
          success: true, 
          data: cached,
          fromCache: true,
          cacheAge: Date.now() - parseInt(localStorage.getItem(this.cacheTimeKey))
        };
      }
    }

    // If trying to force refresh but within cooldown
    if (forceRefresh && !this.isCacheValid()) {
      const timeRemaining = this.getTimeUntilNextFetch();
      if (timeRemaining > 0) {
        const minutesRemaining = Math.ceil(timeRemaining / 60000);
        return {
          success: false,
          error: `Please wait ${minutesRemaining} more minute(s) before refreshing to respect Munda Manager's rate limits.`,
          rateLimited: true
        };
      }
    }

    try {
      // Use CORS proxy if needed
      const apiUrl = this.getApiUrl();
      const url = this.useCorsProxy 
        ? `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`
        : apiUrl;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.campaignData = data;
      
      // Save to cache
      this.saveToCache(data);
      
      return { success: true, data, fromCache: false };
    } catch (error) {
      console.error('Error fetching campaign data:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch campaign data'
      };
    }
  },

  /**
   * Get campaign overview
   */
  getCampaignInfo() {
    if (!this.campaignData) return null;
    return this.campaignData.campaign;
  },

  /**
   * Get all members with their gangs
   */
  getAllMembers() {
    if (!this.campaignData) return [];
    return this.campaignData.members || [];
  },

  /**
   * Get all gangs across all members
   */
  getAllGangs() {
    const members = this.getAllMembers();
    const gangs = [];
    
    members.forEach(member => {
      if (member.gangs && Array.isArray(member.gangs)) {
        member.gangs.forEach(gang => {
          gangs.push({
            ...gang,
            owner: member.user_info.username
          });
        });
      }
    });
    
    return gangs;
  },

  /**
   * Get gangs sorted by rating
   */
  getGangsByRating() {
    const gangs = this.getAllGangs();
    return gangs.sort((a, b) => b.rating - a.rating);
  },

  /**
   * Get gangs sorted by wealth
   */
  getGangsByWealth() {
    const gangs = this.getAllGangs();
    return gangs.sort((a, b) => b.wealth - a.wealth);
  },

  /**
   * Get all territories (both owned and available)
   */
  getAllTerritories() {
    if (!this.campaignData) return { owned: [], available: [] };
    
    const owned = [];
    const available = this.campaignData.available_territories || [];
    
    // Collect owned territories from gangs
    this.getAllGangs().forEach(gang => {
      if (gang.territories && Array.isArray(gang.territories)) {
        gang.territories.forEach(territory => {
          owned.push({
            ...territory,
            gang_name: gang.name,
            gang_type: gang.type,
            gang_colour: gang.colour
          });
        });
      }
    });
    
    return { owned, available };
  },

  /**
   * Get territory distribution by gang
   */
  getTerritoryDistribution() {
    const gangs = this.getAllGangs();
    return gangs.map(gang => ({
      name: gang.name,
      type: gang.type,
      colour: gang.colour,
      territory_count: gang.territory_count || 0,
      territories: gang.territories || []
    }));
  },

  /**
   * Get campaign statistics
   */
  getCampaignStats() {
    const gangs = this.getAllGangs();
    const territories = this.getAllTerritories();
    
    return {
      total_gangs: gangs.length,
      total_members: this.getAllMembers().length,
      total_owned_territories: territories.owned.length,
      total_available_territories: territories.available.length,
      average_rating: gangs.length > 0 
        ? Math.round(gangs.reduce((sum, g) => sum + g.rating, 0) / gangs.length)
        : 0,
      total_wealth: gangs.reduce((sum, g) => sum + g.wealth, 0)
    };
  },

  /**
   * Create mapping from player gang names to gang IDs (for gangs.yml lookup)
   * This requires loading the gangs.yml data to match API gang types to gang IDs
   * @param {Object} gangsData - The loaded gangs.json data
   * @returns {Object} Map of player gang name -> gang_id
   */
  getPlayerGangToIdMapping(gangsData) {
    if (!this.campaignData || !gangsData) return {};
    
    const mapping = {};
    const gangs = this.getAllGangs();
    
    // Create reverse lookup: gang type name -> gang_id
    const typeToId = {};
    Object.entries(gangsData).forEach(([gangId, gangInfo]) => {
      typeToId[gangInfo.name] = gangId;
    });
    
    // Map player gang name to gang_id
    gangs.forEach(gang => {
      const gangId = typeToId[gang.type];
      if (gangId) {
        mapping[gang.name] = gangId;
      } else {
        console.warn(`No gang_id found for gang type: ${gang.type}`);
      }
    });
    
    return mapping;
  },

  /**
   * Get territories controlled by each player gang
   * @returns {Object} Map of player gang name -> array of territory names
   */
  getPlayerGangTerritories() {
    if (!this.campaignData) return {};
    
    const territories = {};
    const gangs = this.getAllGangs();
    
    gangs.forEach(gang => {
      territories[gang.name] = (gang.territories || []).map(t => t.name);
    });
    
    return territories;
  },

  /**
   * Normalize territory name by removing gang-specific suffixes like (*), (AWN), etc.
   * @param {string} name - Territory name
   * @returns {string} Normalized name
   */
  normalizeTerritoryName(name) {
    return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  },

  /**
   * Validate territory mappings against local territories data
   * @param {Array} localTerritories - Array of local territory objects with id and name
   * @returns {Object} Validation results
   */
  validateTerritoryMappings(localTerritories) {
    if (!this.campaignData) {
      return { valid: [], invalid: [], allValid: true, totalChecked: 0 };
    }

    // Build normalized name to ID map from local data
    const nameToIdMap = {};
    localTerritories.forEach(t => {
      const normalizedName = this.normalizeTerritoryName(t.name);
      nameToIdMap[normalizedName] = t.id;
    });

    const territories = this.getAllTerritories();
    const allTerritories = [...territories.owned, ...territories.available];
    
    const valid = [];
    const invalid = [];

    allTerritories.forEach(territory => {
      const apiName = territory.name;
      const territoryId = nameToIdMap[apiName];
      
      if (territoryId) {
        valid.push({ apiName, territoryId });
      } else {
        invalid.push({ apiName });
      }
    });

    return {
      valid,
      invalid,
      allValid: invalid.length === 0,
      totalChecked: allTerritories.length
    };
  }
};