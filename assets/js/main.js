/**
 * main.js — Global page initialisation.
 *
 * Loaded on every page via the default layout.  Applies two behaviours:
 *
 * 1. Auto-adds the `.btn` class to every <button> so they inherit the
 *    shared button styling without each page needing to set it.
 *
 * 2. Makes collapsible reference sections (details.reference-tables-collapsible)
 *    close when clicking anywhere inside the open panel — not just on the
 *    <summary>.  Interactive elements (links, buttons, inputs) are excluded
 *    so click-handlers inside collapsibles still work.
 *
 * No external dependencies.
 */

// Apply base button styles to all buttons on every page
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('button').forEach(button => {
    button.classList.add('btn');
  });
});

// Allow clicking anywhere inside an open collapsible to close it
document.addEventListener('click', (e) => {
  const details = e.target.closest('details.reference-tables-collapsible');
  if (!details || !details.open) return;
  // Don't close if the click was on the summary (it handles its own toggle)
  if (e.target.closest('summary')) return;
  // Don't close if the click was on a nested interactive element
  if (e.target.closest('a, button, input, select, textarea')) return;
  details.open = false;
});
