/* Montaje de chrome compartido: toggle de tema, botón de volver al selector y diálogos. */
(function (root, factory) {
  var api = factory(typeof document !== "undefined" ? document : null, root);
  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.JuegosChrome = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (doc, win) {
  "use strict";

  var hubOrigin = null;

  function resolveHubHref(protocol) {
    return protocol === "file:" ? "../index.html" : "../";
  }

  function hasOpenDialog(targetDoc) {
    var d = targetDoc || doc;
    if (!d || typeof d.querySelector !== "function") return false;
    return Boolean(d.querySelector("dialog[open]"));
  }

  function isStandalone(targetWin) {
    var w = targetWin || win;
    if (!w) return false;
    try {
      if (typeof w.matchMedia === "function") {
        var mq = w.matchMedia("(display-mode: standalone)");
        if (mq && mq.matches) return true;
      }
      if (w.navigator && w.navigator.standalone === true) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function isIosSafari(targetWin) {
    var w = targetWin || win;
    if (!w || !w.navigator) return false;
    var nav = w.navigator;
    var ua = typeof nav.userAgent === "string" ? nav.userAgent : "";
    var platform = typeof nav.platform === "string" ? nav.platform : "";
    var maxTouchPoints = typeof nav.maxTouchPoints === "number" ? nav.maxTouchPoints : 0;

    var isIosDevice = /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
    if (!isIosDevice) return false;

    var isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
    return isSafari;
  }

  function canRegisterServiceWorker(targetWin) {
    var w = targetWin || win;
    if (!w || !w.navigator || !("serviceWorker" in w.navigator) || !w.location) {
      return false;
    }
    var protocol = w.location.protocol;
    var hostname = w.location.hostname;
    if (protocol === "https:") {
      return true;
    }
    if (protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  }

  function resolveSwHref(targetDoc) {
    var d = targetDoc || doc;
    if (d && d.documentElement && d.documentElement.dataset && d.documentElement.dataset.page === "hub") {
      return "./sw.js";
    }
    return "../sw.js";
  }

  function registerServiceWorker(targetDoc, targetWin) {
    var d = targetDoc || doc;
    var w = targetWin || win;
    if (!canRegisterServiceWorker(w)) return null;

    try {
      var res = w.navigator.serviceWorker.register(resolveSwHref(d));
      if (res && typeof res.catch === "function") {
        res.catch(function () {});
      }
      return res;
    } catch (_) {
      return null;
    }
  }

  function mountInstallPrompt(targetDoc, targetWin) {
    var d = targetDoc || doc;
    var w = targetWin || win;
    if (!d || !d.documentElement || !d.documentElement.dataset) return null;
    if (d.documentElement.dataset.page !== "hub") return null;
    if (isStandalone(w)) return null;

    var btn = d.getElementById("installAppBtn");
    if (!btn) {
      btn = d.createElement("button");
      btn.type = "button";
      btn.className = "install-btn";
      btn.id = "installAppBtn";
      btn.hidden = true;
      btn.setAttribute("hidden", "");
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
        '<polyline points="7 10 12 15 17 10"/>' +
        '<line x1="12" y1="15" x2="12" y2="3"/>' +
        '</svg>' +
        '<span>Instalar en el celular</span>';

      var credit = typeof d.querySelector === "function" ? d.querySelector(".credit") : null;
      var main = typeof d.querySelector === "function" ? d.querySelector("main") : null;

      if (main && credit && typeof main.insertBefore === "function") {
        main.insertBefore(btn, credit);
      } else if (d.body && typeof d.body.appendChild === "function") {
        d.body.appendChild(btn);
      }
    }

    var installDialog = d.getElementById("installDialog");
    function ensureInstallDialog() {
      if (!installDialog) {
        installDialog = d.createElement("dialog");
        installDialog.id = "installDialog";
        installDialog.className = "hub-dialog";
        installDialog.setAttribute("aria-labelledby", "installTitle");
        installDialog.innerHTML =
          '<h2 id="installTitle">Instalar en el celular</h2>' +
          '<p>En Safari, tocá el botón <strong>Compartir</strong> y elegí <strong>«Agregar a inicio»</strong>. Después la abrís como cualquier app, incluso sin señal.</p>' +
          '<div class="hub-actions">' +
          '<button class="hub-btn hub-btn-primary" id="installClose" type="button">Entendido</button>' +
          '</div>';
        if (d.body && typeof d.body.appendChild === "function") {
          d.body.appendChild(installDialog);
        }
      }

      var closeBtn = d.getElementById("installClose");
      if (closeBtn && (!closeBtn.dataset || closeBtn.dataset.chromeBound !== "1")) {
        if (closeBtn.dataset) closeBtn.dataset.chromeBound = "1";
        closeBtn.addEventListener("click", function () {
          closeDialog(installDialog);
        });
      }
      bindBackdropClose(installDialog);
      return installDialog;
    }

    var deferredPrompt = null;

    if (w && typeof w.addEventListener === "function") {
      w.addEventListener("beforeinstallprompt", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        deferredPrompt = event;
        btn.hidden = false;
        btn.removeAttribute("hidden");
      });

      w.addEventListener("appinstalled", function () {
        deferredPrompt = null;
        btn.hidden = true;
        btn.setAttribute("hidden", "");
        if (installDialog) {
          closeDialog(installDialog);
        }
      });
    }

    if (isIosSafari(w)) {
      btn.hidden = false;
      btn.removeAttribute("hidden");
    }

    if (!btn.dataset || btn.dataset.chromeBound !== "1") {
      if (btn.dataset) btn.dataset.chromeBound = "1";
      btn.addEventListener("click", function () {
        if (deferredPrompt) {
          if (typeof deferredPrompt.prompt === "function") {
            deferredPrompt.prompt();
          }
          if (deferredPrompt.userChoice && typeof deferredPrompt.userChoice.then === "function") {
            deferredPrompt.userChoice.then(function (choiceResult) {
              if (choiceResult && choiceResult.outcome === "accepted") {
                btn.hidden = true;
                btn.setAttribute("hidden", "");
              }
              deferredPrompt = null;
            }).catch(function () {
              deferredPrompt = null;
            });
          } else {
            deferredPrompt = null;
          }
        } else {
          var dlg = ensureInstallDialog();
          var closeBtn = d.getElementById("installClose");
          openDialog(dlg, closeBtn);
        }
      });
    }

    return btn;
  }

  function openDialog(dialog, focusEl) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else if (typeof dialog.setAttribute === "function") {
      dialog.setAttribute("open", "");
    }
    if (focusEl && typeof focusEl.focus === "function") {
      focusEl.focus();
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      if (dialog.open) dialog.close();
    } else if (typeof dialog.removeAttribute === "function") {
      dialog.removeAttribute("open");
    }
  }

  function bindBackdropClose(dialog) {
    if (!dialog || (dialog.dataset && dialog.dataset.backdropBound === "1")) return;
    if (dialog.dataset) dialog.dataset.backdropBound = "1";
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog(dialog);
    });
  }

  function mountThemeToggle(targetDoc, targetWin) {
    var d = targetDoc || doc;
    var w = targetWin || win;
    if (!d || !d.documentElement || !d.body) return null;
    if (d.documentElement.dataset && d.documentElement.dataset.themeMode === "dark-only") {
      return null;
    }

    var existing = d.getElementById("themeToggle");
    if (existing) return existing;

    var btn = d.createElement("button");
    btn.className = "theme-toggle";
    btn.id = "themeToggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Cambiar a modo oscuro");
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML =
      '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>' +
      "</svg>" +
      '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' +
      "</svg>";

    var themeApi = w && w.JuegosTheme;
    if (themeApi) {
      themeApi.syncToggle(btn, themeApi.get(d));
    }

    btn.addEventListener("click", function () {
      if (w && w.JuegosTheme) {
        w.JuegosTheme.toggle(d, w);
      }
    });

    if (d.body.firstChild) {
      d.body.insertBefore(btn, d.body.firstChild);
    } else {
      d.body.appendChild(btn);
    }

    return btn;
  }

  function openHubDialog(trigger, targetDoc, targetWin) {
    var d = targetDoc || doc;
    var w = targetWin || win;
    if (!d) return;

    var dialog = d.getElementById("hubDialog");
    var stay = d.getElementById("hubStay");
    var fab = d.getElementById("hubFab");
    hubOrigin = trigger || d.activeElement || fab || null;

    if (dialog && typeof dialog.showModal === "function") {
      openDialog(dialog, stay);
    } else if (w && typeof w.confirm === "function" &&
      w.confirm("¿Volver a los juegos? Si hay una partida en curso, se pierde.")) {
      if (w.location) {
        w.location.href = resolveHubHref(w.location.protocol);
      }
    }
  }

  function mountHubChrome(targetDoc, targetWin) {
    var d = targetDoc || doc;
    var w = targetWin || win;
    if (!d || !d.documentElement || !d.body) return null;
    if (d.documentElement.dataset && d.documentElement.dataset.page === "hub") {
      return null;
    }

    var fab = d.getElementById("hubFab");
    if (!fab) {
      fab = d.createElement("button");
      fab.className = "hub-fab";
      fab.id = "hubFab";
      fab.type = "button";
      fab.setAttribute("aria-label", "Volver a los juegos");
      fab.setAttribute("aria-haspopup", "dialog");
      fab.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/>' +
        '<rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>' +
        "</svg>";
      d.body.appendChild(fab);
    }

    var dialog = d.getElementById("hubDialog");
    if (!dialog) {
      dialog = d.createElement("dialog");
      dialog.className = "hub-dialog";
      dialog.id = "hubDialog";
      dialog.setAttribute("aria-labelledby", "hubTitle");
      dialog.innerHTML =
        '<h2 id="hubTitle">¿Volver a los juegos?</h2>' +
        "<p>Volvés al selector. Si hay una partida en curso, se pierde.</p>" +
        '<div class="hub-actions">' +
        '<button class="hub-btn hub-btn-primary" id="hubStay" type="button">Seguir acá</button>' +
        '<button class="hub-btn" id="hubGo" type="button">Volver a los juegos</button>' +
        "</div>";
      d.body.appendChild(dialog);
    }

    var stay = d.getElementById("hubStay");
    var go = d.getElementById("hubGo");

    if (!fab.dataset || fab.dataset.chromeBound !== "1") {
      if (fab.dataset) fab.dataset.chromeBound = "1";
      fab.addEventListener("click", function () {
        openHubDialog(fab, d, w);
      });
    }

    if (stay && (!stay.dataset || stay.dataset.chromeBound !== "1")) {
      if (stay.dataset) stay.dataset.chromeBound = "1";
      stay.addEventListener("click", function () {
        closeDialog(dialog);
      });
    }

    if (go && (!go.dataset || go.dataset.chromeBound !== "1")) {
      if (go.dataset) go.dataset.chromeBound = "1";
      go.addEventListener("click", function () {
        if (w && w.location) {
          w.location.href = resolveHubHref(w.location.protocol);
        }
      });
    }

    bindBackdropClose(dialog);

    if (!dialog.dataset || dialog.dataset.closeBound !== "1") {
      if (dialog.dataset) dialog.dataset.closeBound = "1";
      dialog.addEventListener("close", function () {
        if (hubOrigin && typeof hubOrigin.focus === "function") {
          hubOrigin.focus();
        }
        hubOrigin = null;
      });
    }

    return { fab: fab, dialog: dialog };
  }

  function initChrome(targetDoc, targetWin) {
    var d = targetDoc || doc;
    var w = targetWin || win;
    if (!d || !d.body) return;

    mountThemeToggle(d, w);
    mountHubChrome(d, w);
    mountInstallPrompt(d, w);
    registerServiceWorker(d, w);

    ["howDialog", "rulesDialog", "pickDialog"].forEach(function (id) {
      var el = d.getElementById(id);
      if (el) bindBackdropClose(el);
    });
  }

  if (doc) {
    if (doc.body) {
      initChrome(doc, win);
    } else if (typeof doc.addEventListener === "function") {
      doc.addEventListener("DOMContentLoaded", function () {
        initChrome(doc, win);
      });
    }
  }

  return {
    resolveHubHref: resolveHubHref,
    hasOpenDialog: hasOpenDialog,
    openDialog: openDialog,
    closeDialog: closeDialog,
    openHubDialog: openHubDialog,
    initChrome: initChrome,
    isStandalone: isStandalone,
    isIosSafari: isIosSafari,
    canRegisterServiceWorker: canRegisterServiceWorker,
    resolveSwHref: resolveSwHref,
    registerServiceWorker: registerServiceWorker,
    mountInstallPrompt: mountInstallPrompt
  };
});
