// timer.js - Shared timer utility

const TimerUtil = {
  intervals: {},
  storageKeys: [], // Track all storage keys for cleanup
  storageToContainer: {}, // Map storageKey → containerId for roll display updates

  /**
   * Initialize and display a timer that shows time since last run (with millisecond precision)
   * @param {string} containerId - ID of the element where timer will be displayed
   * @param {string} storageKey - localStorage key to store/retrieve last run time
   */
  init(containerId, storageKey) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Timer container '${containerId}' not found`);
      return;
    }

    // Create timer display element
    const timerDiv = document.createElement("div");
    timerDiv.id = `${containerId}-display`;
    timerDiv.className = "timer-display";
    
    container.appendChild(timerDiv);
    
    // Track storage key for cleanup
    if (!this.storageKeys.includes(storageKey)) {
      this.storageKeys.push(storageKey);
    }
    this.storageToContainer[storageKey] = containerId;

    // Update the display
    this.updateDisplay(storageKey, timerDiv);

    // Set up interval to update every 100ms
    if (this.intervals[storageKey]) {
      clearInterval(this.intervals[storageKey]);
    }
    
    this.intervals[storageKey] = setInterval(() => {
      this.updateDisplay(storageKey, timerDiv);
    }, 100);
  },

  /**
   * Update the timer display
   * @param {string} storageKey - localStorage key
   * @param {HTMLElement} element - Element to update
   */
  updateDisplay(storageKey, element) {
    const lastRun = localStorage.getItem(storageKey);
    
    if (!lastRun) {
      element.innerHTML = "⏱️ <b>Last Run:</b> Never";
      element.classList.remove('timer-green');
      element.classList.add('timer-grey');
      return;
    }

    const lastRunTime = parseInt(lastRun);
    const now = Date.now();
    const elapsedMs = now - lastRunTime;

    let timeHtml;
    if (elapsedMs < 5000) {
      // Show milliseconds for first 5 seconds
      const totalSeconds = Math.floor(elapsedMs / 1000);
      const milliseconds = elapsedMs % 1000;
      timeHtml = `⏱️ <b>Last Run:</b> ${totalSeconds}.${String(milliseconds).padStart(3, '0')} seconds ago`;
      element.classList.remove('timer-grey');
      element.classList.add('timer-green');
    } else {
      // After 5 seconds, just show generic message
      timeHtml = "⏱️ <b>Last Run:</b> More than 5 seconds ago";
      element.classList.remove('timer-green');
      element.classList.add('timer-grey');
    }

    // Append stored rolls — current prominent, previous as a compact history log
    let rollsHtml = '';
    const prevSets = [];
    let currSet = null;
    try {
      const prev3 = localStorage.getItem(`${storageKey}_prev3_rolls`);
      if (prev3) { const arr = JSON.parse(prev3); if (arr && arr.length) prevSets.push(arr.join(', ')); }
    } catch (e) {}
    try {
      const prev2 = localStorage.getItem(`${storageKey}_prev2_rolls`);
      if (prev2) { const arr = JSON.parse(prev2); if (arr && arr.length) prevSets.push(arr.join(', ')); }
    } catch (e) {}
    try {
      const prev = localStorage.getItem(`${storageKey}_prev_rolls`);
      if (prev) { const arr = JSON.parse(prev); if (arr && arr.length) prevSets.push(arr.join(', ')); }
    } catch (e) {}
    try {
      const curr = localStorage.getItem(`${storageKey}_rolls`);
      if (curr) { const arr = JSON.parse(curr); if (arr && arr.length) currSet = arr.join(', '); }
    } catch (e) {}
    if (currSet !== null || prevSets.length > 0) {
      let lines = '';
      if (currSet !== null) lines += `<div class="timer-rolls">🎲 <b>${currSet}</b></div>`;
      if (prevSets.length > 0) lines += `<div class="timer-rolls timer-rolls-prev">History: ${prevSets.join(' | ')}</div>`;
      rollsHtml = lines;
    }

    element.innerHTML = timeHtml + rollsHtml;
  },

  /**
   * Mark the current time as the last run time
   * @param {string} storageKey - localStorage key to update
   * @param {string[]} rolls - Optional roll strings to display in the timer
   */
  markRun(storageKey, rolls = []) {
    // Shift history chain: prev3 ← prev2 ← prev ← current
    const prevRolls    = localStorage.getItem(`${storageKey}_rolls`);
    const prev2Rolls   = localStorage.getItem(`${storageKey}_prev_rolls`);
    const prev3Rolls   = localStorage.getItem(`${storageKey}_prev2_rolls`);
    if (prev3Rolls) {
      localStorage.setItem(`${storageKey}_prev3_rolls`, prev3Rolls);
    } else {
      localStorage.removeItem(`${storageKey}_prev3_rolls`);
    }
    if (prev2Rolls) {
      localStorage.setItem(`${storageKey}_prev2_rolls`, prev2Rolls);
    } else {
      localStorage.removeItem(`${storageKey}_prev2_rolls`);
    }
    if (prevRolls) {
      localStorage.setItem(`${storageKey}_prev_rolls`, prevRolls);
    } else {
      localStorage.removeItem(`${storageKey}_prev_rolls`);
    }
    localStorage.setItem(storageKey, Date.now().toString());
    if (rolls && rolls.length > 0) {
      localStorage.setItem(`${storageKey}_rolls`, JSON.stringify(rolls));
    } else {
      localStorage.removeItem(`${storageKey}_rolls`);
    }
  },

  /**
   * Update stored rolls for a timer and refresh its display.
   * Call this when rolls are determined after markRun was already called.
   * @param {string} storageKey - localStorage key
   * @param {string[]} rolls - Array of roll strings
   */
  recordRolls(storageKey, rolls) {
    if (!rolls || rolls.length === 0) return;
    localStorage.setItem(`${storageKey}_rolls`, JSON.stringify(rolls));
    const containerId = this.storageToContainer[storageKey];
    if (containerId) {
      const el = document.getElementById(`${containerId}-display`);
      if (el) this.updateDisplay(storageKey, el);
    }
  },

  /**
   * Show a specific timer and hide all others on the page
   * @param {string} containerId - ID of the timer container to show
   */
  showTimer(containerId) {
    // Hide all timer displays
    document.querySelectorAll('[id$="-timer-display"]').forEach(timer => {
      timer.classList.add('hidden');
    });
    
    // Show the specific timer
    const timerDisplay = document.getElementById(`${containerId}-display`);
    if (timerDisplay) {
      timerDisplay.classList.remove('hidden');
    }
  },

  /**
   * Hide a specific timer
   * @param {string} containerId - ID of the timer container to hide
   */
  hideTimer(containerId) {
    const timerDisplay = document.getElementById(`${containerId}-display`);
    if (timerDisplay) {
      timerDisplay.classList.add('hidden');
    }
  },

  /**
   * Setup cleanup handlers to reset timer state when navigating away
   */
  setupPageCleanup() {
    window.addEventListener('beforeunload', () => {
      this.clearAllStorage();
    });
  },

  /**
   * Clear all tracked storage keys
   */
  clearAllStorage() {
    this.storageKeys.forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_rolls`);
      localStorage.removeItem(`${key}_prev_rolls`);
      localStorage.removeItem(`${key}_prev2_rolls`);
      localStorage.removeItem(`${key}_prev3_rolls`);
    });
  },

  /**
   * Clean up intervals when no longer needed
   * @param {string} storageKey - localStorage key
   */
  cleanup(storageKey) {
    if (this.intervals[storageKey]) {
      clearInterval(this.intervals[storageKey]);
      delete this.intervals[storageKey];
    }
  }
};
