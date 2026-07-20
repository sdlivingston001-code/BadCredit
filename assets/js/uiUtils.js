/**
 * uiUtils.js — Shared UI utility helpers.
 *
 * Provides reusable DOM helpers for animated result replacement across all tool pages.
 */

/**
 * Replace a container's contents with new content, showing a "Cogitating..."
 * placeholder for 1 second before inserting the new content.
 * Skips the delay if the container is currently empty (first roll).
 *
 * @param {HTMLElement}        container  - The container element to update.
 * @param {HTMLElement|string} newContent - New content: a DOM element or HTML string.
 */
export function animatedReplace(container, newContent) {
  const insert = () => {
    container.innerHTML = '';
    if (newContent instanceof Element) {
      container.appendChild(newContent);
    } else {
      container.innerHTML = newContent;
    }
  };

  container.innerHTML = '<div class="roll-cogitating">Cogitating...</div>';
  setTimeout(insert, 600);
}
