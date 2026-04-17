/**
 * main.js — Global page initialisation.
 *
 * Loaded on every page via the default layout.  Applies one behaviour:
 *
 * 1. Auto-adds the `.btn` class to every <button> so they inherit the
 *    shared button styling without each page needing to set it.
 *
 * No external dependencies.
 */

// Apply base button styles to all buttons on every page
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('button').forEach(button => {
    button.classList.add('btn');
  });
});
