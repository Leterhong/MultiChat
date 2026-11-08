// Deep-link theme override: /?theme=light or #/?theme=dark.
// Also seeds the primitive-layer switches (accent skin, spacing density)
// before first paint so the saved appearance never flashes.
// Loaded synchronously from <head> (CSP allows 'self'), applied pre-paint and
// persisted so the hash-router's history rewrites cannot lose it.
(function () {
  try {
    var m =
      location.search.match(/[?&]theme=(light|dark|system)\b/) ||
      location.hash.match(/[?&]theme=(light|dark|system)\b/);
    if (m) localStorage.setItem('multichat_theme', m[1]);
  } catch (e) {}

  try {
    var root = document.documentElement;
    var skin = localStorage.getItem('multichat_skin');
    var density = localStorage.getItem('multichat_density');
    root.dataset.skin = skin === 'graphite' || skin === 'teal' ? skin : 'blue';
    root.dataset.density = density === 'compact' ? density : 'comfortable';
  } catch (e) {}
})();
