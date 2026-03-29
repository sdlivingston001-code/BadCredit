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
