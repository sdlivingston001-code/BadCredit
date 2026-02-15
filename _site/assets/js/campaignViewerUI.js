// campaignViewerUI.js - Display Munda Manager campaign data

const CampaignViewerUI = {
  containerId: null,
  refreshButton: null,
  timerContainer: null,
  timerInterval: null,
  lastRefreshTime: null,
  localTerritories: null,
  campaignIdInput: null,
  setCampaignIdButton: null,

  async init(containerId, refreshButtonId, timerContainerId, campaignIdInputId, setCampaignIdButtonId) {
    this.containerId = containerId;
    this.refreshButton = document.getElementById(refreshButtonId);
    this.timerContainer = document.getElementById(timerContainerId);
    this.campaignIdInput = document.getElementById(campaignIdInputId);
    this.setCampaignIdButton = document.getElementById(setCampaignIdButtonId);
    
    if (this.refreshButton) {
      this.refreshButton.addEventListener('click', () => this.refresh());
    }

    // Set up campaign ID controls
    if (this.campaignIdInput && this.setCampaignIdButton) {
      // Load current campaign ID
      this.campaignIdInput.value = CampaignViewerEngine.getCampaignId();
      
      this.setCampaignIdButton.addEventListener('click', () => this.setCampaignId());
      
      // Allow Enter key to set campaign ID
      this.campaignIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.setCampaignId();
        }
      });
    }

    // Load local territories data for validation
    await this.loadLocalTerritories();

    // Initialize timer display
    this.initTimer();

    // Initial load
    await this.loadAndDisplay();
  },

  setCampaignId() {
    const newId = this.campaignIdInput.value.trim();
    if (!newId) {
      alert('Please enter a valid campaign ID');
      return;
    }
    
    if (CampaignViewerEngine.setCampaignId(newId)) {
      alert('Campaign ID updated! Refreshing data...');
      this.refresh();
    }
  },

  async loadLocalTerritories() {
    try {
      const baseUrl = window.location.pathname.includes('/BadCredit/') ? '/BadCredit' : '';
      const response = await fetch(`${baseUrl}/data/territories.json?t=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        this.localTerritories = await response.json();
        // Convert to array if needed
        if (!Array.isArray(this.localTerritories)) {
          this.localTerritories = Object.entries(this.localTerritories).map(([id, data]) => ({
            id,
            ...data
          }));
        }
        console.log('CampaignViewerUI: Loaded local territories:', this.localTerritories.length);
      } else {
        console.warn('CampaignViewerUI: Failed to load territories.json');
      }
    } catch (error) {
      console.error('CampaignViewerUI: Error loading local territories:', error);
    }
  },

  initTimer() {
    if (!this.timerContainer) return;

    // Update timer display every second
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 1000);
  },

  updateTimerDisplay() {
    if (!this.timerContainer) return;

    const cacheTime = localStorage.getItem(CampaignViewerEngine.cacheTimeKey);
    if (!cacheTime) {
      this.timerContainer.innerHTML = '<span style="color: #666;">⏱️ Never fetched</span>';
      return;
    }

    const age = Date.now() - parseInt(cacheTime);
    const timeRemaining = CampaignViewerEngine.getTimeUntilNextFetch();

    if (timeRemaining > 0) {
      // Still in cooldown
      const minutes = Math.floor(timeRemaining / 60000);
      const seconds = Math.floor((timeRemaining % 60000) / 1000);
      this.timerContainer.innerHTML = `<span style="color: #dc3545;">⏱️ Next refresh available in ${minutes}:${seconds.toString().padStart(2, '0')}</span>`;
      
      if (this.refreshButton) {
        this.refreshButton.disabled = true;
        this.refreshButton.style.opacity = '0.5';
      }
    } else {
      // Can refresh
      const minutes = Math.floor(age / 60000);
      const seconds = Math.floor((age % 60000) / 1000);
      this.timerContainer.innerHTML = `<span style="color: #28a745;">⏱️ Last fetched ${minutes}:${seconds.toString().padStart(2, '0')} ago</span>`;
      
      if (this.refreshButton) {
        this.refreshButton.disabled = false;
        this.refreshButton.style.opacity = '1';
      }
    }
  },

  async loadAndDisplay() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Show loading state
    container.innerHTML = '<div class="info-box">⏳ Loading campaign data...</div>';

    // Fetch data
    const result = await CampaignViewerEngine.fetchCampaignData();

    if (!result.success) {
      if (result.rateLimited) {
        container.innerHTML = `<div class="info-box yellow">⏳ ${result.error}</div>`;
      } else {
        container.innerHTML = `<div class="error-box">❌ Error: ${result.error}</div>`;
      }
      return;
    }

    // Display data
    this.displayCampaignData(container, result.fromCache);
    this.lastRefreshTime = Date.now();
    
    // Update refresh button
    if (this.refreshButton) {
      this.refreshButton.textContent = '🔄 Refresh Data';
    }

    // Update timer
    this.updateTimerDisplay();
  },

  async refresh() {
    // Check if we can refresh
    const timeRemaining = CampaignViewerEngine.getTimeUntilNextFetch();
    if (timeRemaining > 0) {
      const minutes = Math.ceil(timeRemaining / 60000);
      alert(`Please wait ${minutes} more minute(s) before refreshing to respect Munda Manager's rate limits.`);
      return;
    }

    if (this.refreshButton) {
      this.refreshButton.disabled = true;
      this.refreshButton.textContent = '⏳ Refreshing...';
    }

    // Force refresh
    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = '<div class="info-box">⏳ Fetching fresh data from Munda Manager...</div>';
    }

    const result = await CampaignViewerEngine.fetchCampaignData(true);

    if (!result.success) {
      if (result.rateLimited) {
        if (container) {
          container.innerHTML = `<div class="info-box yellow">⏳ ${result.error}</div>`;
        }
      } else {
        if (container) {
          container.innerHTML = `<div class="error-box">❌ Error: ${result.error}</div>`;
        }
      }
      if (this.refreshButton) {
        this.refreshButton.disabled = false;
        this.refreshButton.textContent = '🔄 Refresh Data';
      }
      return;
    }

    this.displayCampaignData(container, result.fromCache);
    this.updateTimerDisplay();

    if (this.refreshButton) {
      this.refreshButton.textContent = '🔄 Refresh Data';
    }
  },

  displayCampaignData(container, fromCache = false) {
    container.innerHTML = '';

    // Show cache status
    if (fromCache) {
      const cacheNotice = document.createElement('div');
      cacheNotice.className = 'info-box mb-15';
      cacheNotice.innerHTML = '💾 <strong>Showing cached data</strong> (to respect Munda Manager\'s rate limits)';
      container.appendChild(cacheNotice);
    }

    // Campaign Overview
    const campaignInfo = CampaignViewerEngine.getCampaignInfo();
    if (campaignInfo) {
      container.appendChild(this.createCampaignOverview(campaignInfo));
    }

    // Campaign Statistics
    const stats = CampaignViewerEngine.getCampaignStats();
    container.appendChild(this.createStatsSection(stats));

    // Gangs Leaderboard
    container.appendChild(this.createGangsLeaderboard());

    // Territory Distribution
    container.appendChild(this.createTerritorySection());

    // Territory Validation (if local data loaded)
    console.log('CampaignViewerUI: localTerritories available?', !!this.localTerritories);
    if (this.localTerritories) {
      console.log('CampaignViewerUI: Adding territory validation section');
      container.appendChild(this.createTerritoryValidationSection());
    } else {
      console.log('CampaignViewerUI: Skipping territory validation - no local territories loaded');
    }
  },

  createCampaignOverview(campaignInfo) {
    const section = document.createElement('div');
    section.className = 'mb-20';

    const title = document.createElement('h2');
    title.textContent = campaignInfo.campaign_name || 'Campaign';
    title.className = 'mb-10';
    section.appendChild(title);

    const infoBox = document.createElement('div');
    infoBox.className = 'result-box blue mb-15';
    infoBox.innerHTML = `
      <strong>Type:</strong> ${campaignInfo.campaign_type_name || 'Unknown'}<br>
      <strong>Status:</strong> ${campaignInfo.status || 'Unknown'}
    `;
    section.appendChild(infoBox);

    return section;
  },

  createStatsSection(stats) {
    const section = document.createElement('div');
    section.className = 'mb-20';

    const title = document.createElement('h3');
    title.textContent = 'Campaign Statistics';
    title.className = 'mb-10';
    section.appendChild(title);

    const statsBox = document.createElement('div');
    statsBox.className = 'result-box green';
    statsBox.innerHTML = `
      <strong>Total Gangs:</strong> ${stats.total_gangs}<br>
      <strong>Total Members:</strong> ${stats.total_members}<br>
      <strong>Average Gang Rating:</strong> ${stats.average_rating}<br>
      <strong>Total Wealth:</strong> ${stats.total_wealth} credits<br>
      <strong>Owned Territories:</strong> ${stats.total_owned_territories}<br>
      <strong>Available Territories:</strong> ${stats.total_available_territories}
    `;
    section.appendChild(statsBox);

    return section;
  },

  createGangsLeaderboard() {
    const section = document.createElement('div');
    section.className = 'mb-20';

    const title = document.createElement('h3');
    title.textContent = 'Gang Leaderboard (by Rating)';
    title.className = 'mb-10';
    section.appendChild(title);

    const gangs = CampaignViewerEngine.getGangsByRating();

    gangs.forEach((gang, index) => {
      const gangBox = document.createElement('div');
      gangBox.className = 'result-box mb-10';
      gangBox.style.borderLeft = `5px solid ${gang.colour || '#000000'}`;
      
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      
      gangBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <strong>${medal} ${gang.name}</strong><br>
            <span style="font-size: 0.9em; color: #666;">
              ${gang.type} • Owner: ${gang.owner}
            </span>
          </div>
          <div style="text-align: right;">
            <strong>Rating:</strong> ${gang.rating}<br>
            <strong>Wealth:</strong> ${gang.wealth}<br>
            <strong>Territories:</strong> ${gang.territory_count || 0}
          </div>
        </div>
      `;
      section.appendChild(gangBox);
    });

    return section;
  },

  createTerritorySection() {
    const section = document.createElement('div');
    section.className = 'mb-20';

    const title = document.createElement('h3');
    title.textContent = 'Territory Control';
    title.className = 'mb-10';
    section.appendChild(title);

    const territories = CampaignViewerEngine.getAllTerritories();

    // Owned territories
    if (territories.owned.length > 0) {
      const ownedTitle = document.createElement('h4');
      ownedTitle.textContent = 'Controlled Territories';
      ownedTitle.className = 'mb-10 mt-15';
      section.appendChild(ownedTitle);

      territories.owned.forEach(territory => {
        const territoryBox = document.createElement('div');
        territoryBox.className = 'result-box grey mb-10';
        territoryBox.style.borderLeft = `5px solid ${territory.gang_colour || '#000000'}`;
        
        territoryBox.innerHTML = `
          <strong>${territory.name}</strong>
          ${territory.ruined ? ' <span style="color: #dc3545;">(Ruined)</span>' : ''}<br>
          <span style="font-size: 0.9em; color: #666;">
            Controlled by: ${territory.gang_name} (${territory.gang_type})
          </span>
        `;
        section.appendChild(territoryBox);
      });
    }

    // Available territories
    if (territories.available.length > 0) {
      const availableTitle = document.createElement('h4');
      availableTitle.textContent = `Available Territories (${territories.available.length})`;
      availableTitle.className = 'mb-10 mt-15';
      section.appendChild(availableTitle);

      const availableBox = document.createElement('div');
      availableBox.className = 'info-box';
      
      const territoryNames = territories.available
        .filter(t => !t.owning_gangs || t.owning_gangs.length === 0)
        .map(t => t.ruined ? `${t.name} (Ruined)` : t.name)
        .join(', ');
      
      availableBox.innerHTML = `<strong>Unclaimed:</strong> ${territoryNames || 'None'}`;
      section.appendChild(availableBox);
    }

    return section;
  },

  createTerritoryValidationSection() {
    const section = document.createElement('div');
    section.className = 'mb-20';

    const title = document.createElement('h3');
    title.textContent = 'Territory Mapping Validation';
    title.className = 'mb-10';
    section.appendChild(title);

    const validation = CampaignViewerEngine.validateTerritoryMappings(this.localTerritories);

    // Summary box
    const summaryBox = document.createElement('div');
    summaryBox.className = validation.allValid ? 'result-box green mb-15' : 'result-box yellow mb-15';
    summaryBox.innerHTML = `
      <strong>Validation Summary:</strong><br>
      ✅ Valid Mappings: ${validation.valid.length}<br>
      ${validation.invalid.length > 0 ? `⚠️ Invalid Mappings: ${validation.invalid.length}<br>` : ''}
      <strong>Total Territories Checked:</strong> ${validation.totalChecked}
    `;
    section.appendChild(summaryBox);

    // Show invalid mappings if any
    if (validation.invalid.length > 0) {
      const invalidTitle = document.createElement('h4');
      invalidTitle.textContent = 'Unmapped Territories';
      invalidTitle.className = 'mb-10';
      invalidTitle.style.color = '#dc3545';
      section.appendChild(invalidTitle);

      const invalidBox = document.createElement('div');
      invalidBox.className = 'info-box yellow mb-15';
      const invalidList = validation.invalid.map(t => t.apiName).join(', ');
      invalidBox.innerHTML = `<strong>These API territories have no matching local ID:</strong><br>${invalidList}`;
      section.appendChild(invalidBox);
    }

    // Show valid mappings
    if (validation.valid.length > 0) {
      const validTitle = document.createElement('h4');
      validTitle.textContent = 'Valid Territory Mappings';
      validTitle.className = 'mb-10';
      section.appendChild(validTitle);

      const validBox = document.createElement('div');
      validBox.className = 'info-box mb-15';
      validBox.style.maxHeight = '200px';
      validBox.style.overflowY = 'auto';
      const mappingList = validation.valid
        .map(t => `<span style="font-family: monospace;">${t.apiName} → ${t.territoryId}</span>`)
        .join('<br>');
      validBox.innerHTML = mappingList;
      section.appendChild(validBox);
    }

    return section;
  }
};
