/* Apply before styles paint, without inline script or relaxed CSP. */
"use strict";
(function () {
  const key = 'canastaclara_theme_v1';
  const preference = window.matchMedia('(prefers-color-scheme: light)');
  let saved;
  try { saved = localStorage.getItem(key); } catch { /* Storage can be disabled. */ }
  let explicit = saved === 'light' || saved === 'dark';
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById('themeToggle');
    if (button) {
      const label = theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';
      button.textContent = theme === 'dark' ? 'Claro' : 'Oscuro';
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }
  function current() { return document.documentElement.dataset.theme; }
  apply(explicit ? saved : preference.matches ? 'light' : 'dark');
  document.addEventListener('DOMContentLoaded', function () {
    apply(current());
    document.getElementById('themeToggle').addEventListener('click', function () {
      explicit = true;
      const theme = current() === 'dark' ? 'light' : 'dark';
      apply(theme);
      try { localStorage.setItem(key, theme); } catch { /* The current tab still works. */ }
    });
  });
  preference.addEventListener('change', function (event) {
    if (!explicit) apply(event.matches ? 'light' : 'dark');
  });
  window.addEventListener('storage', function (event) {
    if (event.key !== key) return;
    explicit = event.newValue === 'light' || event.newValue === 'dark';
    apply(explicit ? event.newValue : preference.matches ? 'light' : 'dark');
  });
})();
