/* Sincronización de tema compartido entre el índice y los juegos.
   Se carga síncrono en <head> para evitar flash antes del primer paint. */
(function (root, factory) {
  var api = factory(typeof document !== "undefined" ? document : null, root);
  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.JuegosTheme = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (doc, win) {
  "use strict";

  var KEY = "juegos-theme";

  function getDoc(targetDoc) {
    return targetDoc || doc;
  }

  function isDarkOnly(targetDoc) {
    var d = getDoc(targetDoc);
    return Boolean(
      d &&
        d.documentElement &&
        d.documentElement.dataset &&
        d.documentElement.dataset.themeMode === "dark-only"
    );
  }

  function readStored(targetWin) {
    var w = targetWin || win;
    try {
      var stored = w && w.localStorage ? w.localStorage.getItem(KEY) : null;
      if (stored === "dark" || stored === "light") return stored;
    } catch (e) {}
    return null;
  }

  function prefersDark(targetWin) {
    var w = targetWin || win;
    try {
      return Boolean(w && w.matchMedia && w.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch (e) {
      return false;
    }
  }

  function resolveInitial(targetDoc, targetWin) {
    if (isDarkOnly(targetDoc)) return "dark";
    var stored = readStored(targetWin);
    if (stored) return stored;
    return prefersDark(targetWin) ? "dark" : "light";
  }

  function get(targetDoc) {
    var d = getDoc(targetDoc);
    if (isDarkOnly(d)) return "dark";
    return d &&
      d.documentElement &&
      d.documentElement.dataset &&
      d.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light";
  }

  function syncToggle(toggleEl, theme) {
    if (!toggleEl) return;
    var dark = theme === "dark";
    toggleEl.setAttribute("aria-pressed", dark ? "true" : "false");
    toggleEl.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  }

  function apply(theme, persist, targetDoc, targetWin) {
    var d = getDoc(targetDoc);
    var w = targetWin || win;
    if (!d || !d.documentElement) return "light";
    if (isDarkOnly(d)) return "dark";

    var normalized = theme === "dark" ? "dark" : "light";
    var dark = normalized === "dark";

    if (dark) {
      d.documentElement.dataset.theme = "dark";
    } else {
      delete d.documentElement.dataset.theme;
    }

    var metaColor = d.querySelector && d.querySelector('meta[name="theme-color"]');
    if (metaColor) {
      var lightVal = metaColor.getAttribute("data-light") || "#F6F1E9";
      var darkVal = metaColor.getAttribute("data-dark") || "#12110F";
      metaColor.setAttribute("content", dark ? darkVal : lightVal);
    }

    var metaScheme = d.querySelector && d.querySelector('meta[name="color-scheme"]');
    if (metaScheme) {
      metaScheme.setAttribute("content", normalized);
    }

    var toggleBtn = d.getElementById && d.getElementById("themeToggle");
    syncToggle(toggleBtn, normalized);

    if (persist) {
      try {
        if (w && w.localStorage) w.localStorage.setItem(KEY, normalized);
      } catch (e) {}
    }

    return normalized;
  }

  function toggle(targetDoc, targetWin) {
    if (isDarkOnly(targetDoc)) return "dark";
    var next = get(targetDoc) === "dark" ? "light" : "dark";
    return apply(next, true, targetDoc, targetWin);
  }

  if (doc && doc.documentElement && !isDarkOnly(doc)) {
    apply(resolveInitial(doc, win), false, doc, win);
  }

  return {
    KEY: KEY,
    isDarkOnly: isDarkOnly,
    resolveInitial: resolveInitial,
    get: get,
    apply: apply,
    toggle: toggle,
    syncToggle: syncToggle
  };
});
