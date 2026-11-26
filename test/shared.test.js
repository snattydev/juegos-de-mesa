"use strict";

/*
 * Pruebas unitarias de los módulos compartidos (shared/). Sin dependencias.
 *   node test/shared.test.js
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = require(path.join(ROOT, "shared", "games.js"));

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("  ok   " + name);
  } catch (error) {
    failures.push({ name, error });
    console.log("  FAIL " + name);
    console.log("       " + String(error && error.message ? error.message : error));
  }
}

function makeMockElement(tagName) {
  const attrs = new Map();
  const listeners = new Map();
  const children = [];
  const el = {
    tagName: String(tagName || "div").toUpperCase(),
    id: "",
    className: "",
    type: "",
    open: false,
    dataset: {},
    children: children,
    innerHTML: "",
    firstChild: null,
    setAttribute(k, v) {
      attrs.set(k, String(v));
      if (k === "id") this.id = String(v);
      if (k === "open") this.open = true;
    },
    getAttribute(k) {
      return attrs.has(k) ? attrs.get(k) : null;
    },
    removeAttribute(k) {
      attrs.delete(k);
      if (k === "open") this.open = false;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      const list = listeners.get(event.type) || [];
      list.forEach((fn) => fn(event));
    },
    appendChild(child) {
      children.push(child);
      this.firstChild = children[0] || null;
      return child;
    },
    insertBefore(child, ref) {
      const idx = children.indexOf(ref);
      if (idx === -1) children.push(child);
      else children.splice(idx, 0, child);
      this.firstChild = children[0] || null;
      return child;
    },
    focus() {}
  };
  return el;
}

function createDomSandbox(options) {
  const opts = options || {};
  const store = Object.assign({}, opts.storage || {});
  const htmlEl = makeMockElement("html");
  if (opts.themeMode) htmlEl.dataset.themeMode = opts.themeMode;
  if (opts.page) htmlEl.dataset.page = opts.page;

  const metaColor = makeMockElement("meta");
  metaColor.setAttribute("name", "theme-color");
  metaColor.setAttribute("content", opts.lightColor || "#F6F1E9");
  if (opts.lightColor) metaColor.setAttribute("data-light", opts.lightColor);
  if (opts.darkColor) metaColor.setAttribute("data-dark", opts.darkColor);

  const metaScheme = makeMockElement("meta");
  metaScheme.setAttribute("name", "color-scheme");
  metaScheme.setAttribute("content", "light");

  const body = makeMockElement("body");
  const byId = new Map();

  function registerTree(node) {
    if (node.id) byId.set(node.id, node);
    if (Array.isArray(node.children)) {
      node.children.forEach(registerTree);
    }
  }

  const origAppend = body.appendChild.bind(body);
  body.appendChild = (child) => {
    origAppend(child);
    registerTree(child);
    if (child.tagName === "DIALOG" && child.id === "hubDialog") {
      const stay = makeMockElement("button");
      stay.id = "hubStay";
      const go = makeMockElement("button");
      go.id = "hubGo";
      byId.set("hubStay", stay);
      byId.set("hubGo", go);
    }
    return child;
  };

  const origInsertBefore = body.insertBefore.bind(body);
  body.insertBefore = (child, ref) => {
    origInsertBefore(child, ref);
    registerTree(child);
    return child;
  };

  const doc = {
    documentElement: htmlEl,
    body: opts.noBody ? null : body,
    readyState: opts.noBody ? "loading" : "complete",
    createElement(tag) {
      return makeMockElement(tag);
    },
    getElementById(id) {
      return byId.get(id) || null;
    },
    querySelector(selector) {
      if (selector === 'meta[name="theme-color"]') return metaColor;
      if (selector === 'meta[name="color-scheme"]') return opts.hasColorScheme === false ? null : metaScheme;
      if (selector === "dialog[open]") {
        for (const el of byId.values()) {
          if (el.tagName === "DIALOG" && el.open) return el;
        }
        return null;
      }
      return null;
    },
    addEventListener() {}
  };

  const sandbox = {
    document: doc,
    localStorage: {
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
      },
      setItem(k, v) {
        store[k] = String(v);
      }
    },
    matchMedia(query) {
      return { matches: Boolean(opts.prefersDark) && query.includes("dark") };
    },
    location: { protocol: opts.protocol || "https:", href: "" },
    confirm() {
      return true;
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return { sandbox, doc, htmlEl, metaColor, metaScheme, store, byId };
}

console.log("\nCatálogo (shared/games.js)");

check("declara los 9 juegos con slugs únicos y metadatos válidos", () => {
  assert.equal(CATALOG.games.length, 9);
  const slugs = new Set();
  const hexRe = /^#[0-9A-Fa-f]{6}$/;
  CATALOG.games.forEach((game) => {
    assert.equal(typeof game.slug, "string");
    assert.ok(game.slug.length > 0 && !slugs.has(game.slug), "slug duplicado: " + game.slug);
    slugs.add(game.slug);
    assert.ok(game.title && game.mono && game.meta && game.intro);
    assert.ok(hexRe.test(game.accent), "accent inválido en " + game.slug);
    assert.ok(hexRe.test(game.monoBg), "monoBg inválido en " + game.slug);
    assert.ok(hexRe.test(game.monoInk), "monoInk inválido en " + game.slug);
    assert.equal(typeof game.darkOnly, "boolean");
    assert.ok(game.dataFile && game.dataGlobal);
  });
});

check("resolveGameHref y resolveHubHref soportan file:// y HTTP", () => {
  assert.equal(CATALOG.resolveGameHref("ahorcado", "file:"), "ahorcado/index.html");
  assert.equal(CATALOG.resolveGameHref("ahorcado", "https:"), "ahorcado/");
  assert.equal(CATALOG.resolveGameHref("/hdp/", "http:"), "hdp/");
  assert.equal(CATALOG.resolveHubHref("file:"), "../index.html");
  assert.equal(CATALOG.resolveHubHref("https:"), "../");
});

check("hasSeenIntro y markIntroSeen persisten intros vistas por juego", () => {
  const mem = {};
  const fakeStorage = {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    setItem(k, v) {
      mem[k] = String(v);
    }
  };
  assert.equal(CATALOG.hasSeenIntro("hdp", fakeStorage), false);
  assert.equal(CATALOG.markIntroSeen("hdp", fakeStorage), true);
  assert.equal(CATALOG.hasSeenIntro("hdp", fakeStorage), true);
  assert.equal(CATALOG.hasSeenIntro("ahorcado", fakeStorage), false);
});

console.log("\nTema (shared/theme.js)");

const themeCode = fs.readFileSync(path.join(ROOT, "shared", "theme.js"), "utf8");
const chromeCode = fs.readFileSync(path.join(ROOT, "shared", "chrome.js"), "utf8");

check("arranca en light por defecto cuando no hay preferencia ni storage", () => {
  const ctx = createDomSandbox({ prefersDark: false });
  vm.runInContext(themeCode, ctx.sandbox, { filename: "shared/theme.js" });
  assert.equal(ctx.sandbox.JuegosTheme.get(), "light");
  assert.equal(ctx.htmlEl.dataset.theme, undefined);
  assert.equal(ctx.metaColor.getAttribute("content"), "#F6F1E9");
});

check("respeta prefers-color-scheme: dark cuando localStorage está vacío", () => {
  const ctx = createDomSandbox({ prefersDark: true });
  vm.runInContext(themeCode, ctx.sandbox, { filename: "shared/theme.js" });
  assert.equal(ctx.sandbox.JuegosTheme.get(), "dark");
  assert.equal(ctx.htmlEl.dataset.theme, "dark");
  assert.equal(ctx.metaColor.getAttribute("content"), "#12110F");
});

check("prioriza localStorage juegos-theme sobre prefers-color-scheme", () => {
  const ctx = createDomSandbox({ prefersDark: true, storage: { "juegos-theme": "light" } });
  vm.runInContext(themeCode, ctx.sandbox, { filename: "shared/theme.js" });
  assert.equal(ctx.sandbox.JuegosTheme.get(), "light");
  assert.equal(ctx.htmlEl.dataset.theme, undefined);
});

check("toggle cambia tema, respeta colores custom y persiste en juegos-theme", () => {
  const ctx = createDomSandbox({ lightColor: "#F4ECDF", darkColor: "#12100E" });
  vm.runInContext(themeCode, ctx.sandbox, { filename: "shared/theme.js" });
  assert.equal(ctx.metaColor.getAttribute("content"), "#F4ECDF");

  const next = ctx.sandbox.JuegosTheme.toggle();
  assert.equal(next, "dark");
  assert.equal(ctx.htmlEl.dataset.theme, "dark");
  assert.equal(ctx.metaColor.getAttribute("content"), "#12100E");
  assert.equal(ctx.metaScheme.getAttribute("content"), "dark");
  assert.equal(ctx.store["juegos-theme"], "dark");
});

check("no-op cuando el documento declara data-theme-mode='dark-only'", () => {
  const ctx = createDomSandbox({ themeMode: "dark-only", storage: { "juegos-theme": "light" } });
  vm.runInContext(themeCode, ctx.sandbox, { filename: "shared/theme.js" });
  assert.equal(ctx.sandbox.JuegosTheme.isDarkOnly(), true);
  assert.equal(ctx.sandbox.JuegosTheme.get(), "dark");
  assert.equal(ctx.sandbox.JuegosTheme.toggle(), "dark");
  assert.equal(ctx.htmlEl.dataset.theme, undefined);
});

console.log("\nChrome compartido (shared/chrome.js)");

check("monta themeToggle y hubFab en juegos claro/oscuro y navega según protocolo", () => {
  const ctx = createDomSandbox({ protocol: "file:" });
  vm.runInContext(themeCode, ctx.sandbox, { filename: "shared/theme.js" });
  vm.runInContext(chromeCode, ctx.sandbox, { filename: "shared/chrome.js" });

  assert.ok(ctx.doc.getElementById("themeToggle"), "falta themeToggle");
  assert.ok(ctx.doc.getElementById("hubFab"), "falta hubFab");
  assert.ok(ctx.doc.getElementById("hubDialog"), "falta hubDialog");

  assert.equal(ctx.sandbox.JuegosChrome.resolveHubHref("file:"), "../index.html");
  assert.equal(ctx.sandbox.JuegosChrome.resolveHubHref("https:"), "../");

  const go = ctx.doc.getElementById("hubGo");
  go.dispatchEvent({ type: "click", target: go });
  assert.equal(ctx.sandbox.location.href, "../index.html");
});

check("omite themeToggle en dark-only y omite hubFab en data-page='hub'", () => {
  const darkGame = createDomSandbox({ themeMode: "dark-only" });
  vm.runInContext(themeCode, darkGame.sandbox, { filename: "shared/theme.js" });
  vm.runInContext(chromeCode, darkGame.sandbox, { filename: "shared/chrome.js" });
  assert.equal(darkGame.doc.getElementById("themeToggle"), null);
  assert.ok(darkGame.doc.getElementById("hubFab"));

  const hub = createDomSandbox({ page: "hub" });
  vm.runInContext(themeCode, hub.sandbox, { filename: "shared/theme.js" });
  vm.runInContext(chromeCode, hub.sandbox, { filename: "shared/chrome.js" });
  assert.ok(hub.doc.getElementById("themeToggle"));
  assert.equal(hub.doc.getElementById("hubFab"), null);
});

check("hasOpenDialog detecta diálogos abiertos", () => {
  const ctx = createDomSandbox({});
  vm.runInContext(themeCode, ctx.sandbox, { filename: "shared/theme.js" });
  vm.runInContext(chromeCode, ctx.sandbox, { filename: "shared/chrome.js" });
  assert.equal(ctx.sandbox.JuegosChrome.hasOpenDialog(), false);
  ctx.doc.getElementById("hubDialog").open = true;
  assert.equal(ctx.sandbox.JuegosChrome.hasOpenDialog(), true);
});

console.log("\nPWA (shared/chrome.js)");

check("canRegisterServiceWorker valida protocolo, host y disponibilidad de la API", () => {
  const api = require(path.join(ROOT, "shared", "chrome.js"));

  // https: en cualquier host
  assert.equal(
    api.canRegisterServiceWorker({
      location: { protocol: "https:", hostname: "example.com" },
      navigator: { serviceWorker: {} }
    }),
    true
  );

  // http: en localhost y 127.0.0.1
  assert.equal(
    api.canRegisterServiceWorker({
      location: { protocol: "http:", hostname: "localhost" },
      navigator: { serviceWorker: {} }
    }),
    true
  );
  assert.equal(
    api.canRegisterServiceWorker({
      location: { protocol: "http:", hostname: "127.0.0.1" },
      navigator: { serviceWorker: {} }
    }),
    true
  );

  // file: no permitido
  assert.equal(
    api.canRegisterServiceWorker({
      location: { protocol: "file:", hostname: "" },
      navigator: { serviceWorker: {} }
    }),
    false
  );

  // http: en IP LAN
  assert.equal(
    api.canRegisterServiceWorker({
      location: { protocol: "http:", hostname: "192.168.1.5" },
      navigator: { serviceWorker: {} }
    }),
    false
  );

  // sin navigator.serviceWorker
  assert.equal(
    api.canRegisterServiceWorker({
      location: { protocol: "https:", hostname: "example.com" },
      navigator: {}
    }),
    false
  );
  assert.equal(
    api.canRegisterServiceWorker({
      location: { protocol: "https:", hostname: "example.com" }
    }),
    false
  );
});

check("resolveSwHref retorna ./sw.js en hub y ../sw.js en juegos", () => {
  const api = require(path.join(ROOT, "shared", "chrome.js"));

  const hubDoc = { documentElement: { dataset: { page: "hub" } } };
  assert.equal(api.resolveSwHref(hubDoc), "./sw.js");

  const gameDoc = { documentElement: { dataset: {} } };
  assert.equal(api.resolveSwHref(gameDoc), "../sw.js");

  const emptyDoc = {};
  assert.equal(api.resolveSwHref(emptyDoc), "../sw.js");
});

check("isStandalone detecta display-mode: standalone o navigator.standalone", () => {
  const api = require(path.join(ROOT, "shared", "chrome.js"));

  // matchMedia standalone
  assert.equal(
    api.isStandalone({
      matchMedia(q) {
        return { matches: q === "(display-mode: standalone)" };
      }
    }),
    true
  );

  // navigator.standalone === true
  assert.equal(
    api.isStandalone({
      matchMedia() {
        return { matches: false };
      },
      navigator: { standalone: true }
    }),
    true
  );

  // ninguno
  assert.equal(
    api.isStandalone({
      matchMedia() {
        return { matches: false };
      },
      navigator: { standalone: false }
    }),
    false
  );
  assert.equal(api.isStandalone({}), false);
});

check("isIosSafari identifica Safari en iOS y excluye CriOS o Chrome en Android", () => {
  const api = require(path.join(ROOT, "shared", "chrome.js"));

  const iphoneSafariUA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  assert.equal(
    api.isIosSafari({
      navigator: { userAgent: iphoneSafariUA }
    }),
    true
  );

  const iosChromeUA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/117.0.5938.108 Mobile/15E148 Safari/604.1";
  assert.equal(
    api.isIosSafari({
      navigator: { userAgent: iosChromeUA }
    }),
    false
  );

  const androidChromeUA =
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36";
  assert.equal(
    api.isIosSafari({
      navigator: { userAgent: androidChromeUA }
    }),
    false
  );
});

check("registerServiceWorker registra ./sw.js en hub sobre https: y omite en file:", () => {
  const api = require(path.join(ROOT, "shared", "chrome.js"));

  const registeredCalls = [];
  const fakeNav = {
    serviceWorker: {
      register(path) {
        registeredCalls.push(path);
        return Promise.resolve();
      }
    }
  };

  const hubDoc = { documentElement: { dataset: { page: "hub" } } };
  const httpsWin = {
    location: { protocol: "https:", hostname: "example.com" },
    navigator: fakeNav
  };

  const result = api.registerServiceWorker(hubDoc, httpsWin);
  assert.ok(result);
  assert.deepEqual(registeredCalls, ["./sw.js"]);

  // en file: no registra
  const fileWin = {
    location: { protocol: "file:", hostname: "" },
    navigator: fakeNav
  };
  const fileResult = api.registerServiceWorker(hubDoc, fileWin);
  assert.equal(fileResult, null);
  assert.equal(registeredCalls.length, 1);
});

check("mountInstallPrompt maneja ciclo de vida del botón de instalación y omite en standalone o juegos", () => {
  const api = require(path.join(ROOT, "shared", "chrome.js"));

  // 1. En páginas que no son hub no monta nada
  const nonHubCtx = createDomSandbox({ page: "" });
  const nonHubBtn = api.mountInstallPrompt(nonHubCtx.doc, nonHubCtx.sandbox);
  assert.equal(nonHubBtn, null);
  assert.equal(nonHubCtx.doc.getElementById("installAppBtn"), null);

  // 2. En standalone no monta nada
  const standaloneCtx = createDomSandbox({ page: "hub" });
  standaloneCtx.sandbox.navigator = { standalone: true };
  const standaloneBtn = api.mountInstallPrompt(standaloneCtx.doc, standaloneCtx.sandbox);
  assert.equal(standaloneBtn, null);
  assert.equal(standaloneCtx.doc.getElementById("installAppBtn"), null);

  // 3. En hub (no standalone) monta el botón inicialmente oculto
  const hubCtx = createDomSandbox({ page: "hub" });
  const listeners = new Map();
  hubCtx.sandbox.addEventListener = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  };
  hubCtx.sandbox.dispatchEvent = (event) => {
    const list = listeners.get(event.type) || [];
    list.forEach((fn) => fn(event));
  };

  const btn = api.mountInstallPrompt(hubCtx.doc, hubCtx.sandbox);
  assert.ok(btn);
  assert.equal(btn.id, "installAppBtn");
  assert.equal(btn.hidden, true);

  // dispatch beforeinstallprompt llama preventDefault() y desoculta el botón
  let prevented = false;
  hubCtx.sandbox.dispatchEvent({
    type: "beforeinstallprompt",
    preventDefault() {
      prevented = true;
    }
  });
  assert.equal(prevented, true);
  assert.equal(btn.hidden, false);

  // dispatch appinstalled vuelve a ocultar el botón
  hubCtx.sandbox.dispatchEvent({ type: "appinstalled" });
  assert.equal(btn.hidden, true);
});

console.log("\n" + passed + " pruebas pasaron, " + failures.length + " fallaron.");

if (failures.length > 0) {
  process.exit(1);
}
