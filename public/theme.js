// Sets the theme before the page draws, so it does not flash the wrong colours.
// The page loads this file in <head> without "defer". It is a file, not an inline script,
// so the Content Security Policy can stay at script-src 'self'.
// "day" or "night" comes from the reader's choice (localStorage "theme"), else from the device setting.
(function () {
  var theme = null;
  try { theme = localStorage.getItem('theme'); } catch (e) { /* storage blocked */ }
  if (theme !== 'day' && theme !== 'night') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
