// Apply base button styles to all buttons on every page
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('button').forEach(button => {
    button.classList.add('btn');
  });
});
