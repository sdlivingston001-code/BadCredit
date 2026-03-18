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

    // Append stored rolls if present
    let rollsHtml = '';
    try {
      const prevStored = localStorage.getItem(`${storageKey}_prev_rolls`);
      if (prevStored) {
        const prevRolls = JSON.parse(prevStored);
        if (prevRolls && prevRolls.length > 0) {
          rollsHtml += `<div class="timer-rolls timer-rolls-prev">🎲 <b>Prev:</b> ${prevRolls.join(', ')}</div>`;
        }
      }
    } catch (e) { /* ignore parse errors */ }
    try {
      const stored = localStorage.getItem(`${storageKey}_rolls`);
      if (stored) {
        const rolls = JSON.parse(stored);
        if (rolls && rolls.length > 0) {
          rollsHtml += `<div class="timer-rolls">🎲 <b>Rolls:</b> ${rolls.join(', ')}</div>`;
        }
      }
    } catch (e) { /* ignore parse errors */ }

    element.innerHTML = timeHtml + rollsHtml;
  },

  /**
   * Mark the current time as the last run time
   * @param {string} storageKey - localStorage key to update
   * @param {string[]} rolls - Optional roll strings to display in the timer
   */
  markRun(storageKey, rolls = []) {
    // Archive previous rolls as struck-through before replacing
    const prevRolls = localStorage.getItem(`${storageKey}_rolls`);
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
