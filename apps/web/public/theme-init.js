(function () {
  try {
    var t = localStorage.getItem('kanzen:theme');
    var dark =
      t === 'dark' ||
      ((!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (t === 'light' || t === 'dark') root.dataset.theme = t;
    root.style.colorScheme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#15120d' : '#f5eee0');
  } catch (err) {
    // localStorage or matchMedia unavailable; the app renders in its default light theme.
  }
})();
