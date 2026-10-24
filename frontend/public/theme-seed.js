// Deep-link theme override: /?theme=light or #/?theme=dark.
// Loaded synchronously from <head> (CSP allows 'self'), applied pre-paint and
// persisted so the hash-router's history rewrites cannot lose it.
(function () {
  try {
    var m =
      location.search.match(/[?&]theme=(light|dark|system)\b/) ||
      location.hash.match(/[?&]theme=(light|dark|system)\b/);
    if (m) localStorage.setItem('multichat_theme', m[1]);
  } catch (e) {}
})();
