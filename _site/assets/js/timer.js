// timer.js - Shared timer utility

const TimerUtil = {
  intervals: {},
  storageKeys: [], // Track all storage keys for cleanup

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
    timerDiv.style.padding = "10px";
    timerDiv.style.marginBottom = "15px";
    timerDiv.style.backgroundColor = "#f8f9fa";
    timerDiv.style.border = "1px solid #dee2e6";
    timerDiv.style.borderRadius = "4px";
    timerDiv.style.fontFamily = "monospace";
    timerDiv.style.fontSize = "14px";
    timerDiv.style.display = "none"; // Start hidden
    
    container.appendChild(timerDiv);
    
    // Track storage key for cleanup
    if (!this.storageKeys.includes(storageKey)) {
      this.storageKeys.push(storageKey);
    }

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
      element.innerHTML = "⏱️ <strong>Last Run:</strong> Never";
      element.style.color = "#6c757d";
      return;
    }

    const lastRunTime = parseInt(lastRun);
    const now = Date.now();
    const elapsedMs = now - lastRunTime;

    if (elapsedMs < 5000) {
      // Show milliseconds for first 5 seconds
      const totalSeconds = Math.floor(elapsedMs / 1000);
      const milliseconds = elapsedMs % 1000;
      element.innerHTML = `⏱️ <strong>Last Run:</strong> ${totalSeconds}.${String(milliseconds).padStart(3, '0')} seconds ago`;
      element.style.color = "#28a745"; // Green
    } else {
      // After 5 seconds, just show generic message
      element.innerHTML = "⏱️ <strong>Last Run:</strong> More than 5 seconds ago";
      element.style.color = "#6c757d"; // Grey
    }
  },

  /**
   * Mark the current time as the last run time
   * @param {string} storageKey - localStorage key to update
   */
  markRun(storageKey) {
    localStorage.setItem(storageKey, Date.now().toString());
  },

  /**
   * Show a specific timer and hide all others on the page
   * @param {string} containerId - ID of the timer container to show
   */
  showTimer(containerId) {
    // Hide all timer displays
    document.querySelectorAll('[id$="-timer-display"]').forEach(timer => {
      timer.style.display = 'none';
    });
    
    // Show the specific timer
    const timerDisplay = document.getElementById(`${containerId}-display`);
    if (timerDisplay) {
      timerDisplay.style.display = 'block';
    }
  },

  /**
   * Hide a specific timer
   * @param {string} containerId - ID of the timer container to hide
   */
  hideTimer(containerId) {
    const timerDisplay = document.getElementById(`${containerId}-display`);
    if (timerDisplay) {
      timerDisplay.style.display = 'none';
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
