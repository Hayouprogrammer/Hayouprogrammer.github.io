/*
 * Theme resolution, before first paint.
 *
 * This lives in an external, render-blocking file rather than inline in the
 * document on purpose. An inline script is the only thing on this site that a
 * strict `script-src 'self'` Content-Security-Policy has to make an exception
 * for, and a CSP with an `'unsafe-inline'` escape hatch is not a CSP. Moving one
 * hundred bytes into a file lets the real policy be enforced from
 * public/_headers, and the script blocks rendering anyway so there is still no
 * flash of the wrong sheet.
 *
 * Fail-soft throughout: if storage is unavailable (private browsing) or the
 * media query is unsupported, the page still renders in the light scheme.
 */
(function () {
  try {
    var stored = null;
    try {
      stored = window.localStorage.getItem("hg-theme");
    } catch (e) {
      /* storage blocked: fall through to the system preference */
    }
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {
    /* no dark class: the light scheme is the default and needs nothing */
  }
})();
