# CLAUDE.md

Leé primero [AGENTS.md](AGENTS.md): ahí está la arquitectura completa, la guía para crear juegos nuevos y el detalle de cada convención.

## Reglas no negociables

- **Cero dependencias y cero build:** HTML/CSS/JS vanilla. No agregues `package.json`, `node_modules`, bundlers ni ES modules; todo debe andar tanto con doble clic (`file://`) como por HTTP.
- **Assets compartidos en [shared/](shared/):** el catálogo vive en [shared/games.js](shared/games.js), el tema en [shared/theme.js](shared/theme.js) y la navegación/toggle en [shared/chrome.css](shared/chrome.css) + [shared/chrome.js](shared/chrome.js). No dupliques toggles ni diálogos de volver en cada juego.
- **Un juego por carpeta:** `<slug>/index.html`, `<slug>/README.md`, `<slug>/AGENTS.md`, `<slug>/assets/`, `<slug>/data/`, `<slug>/test/game.test.js`.
- **Verificación obligatoria antes de cerrar o commitear:** `node test/checks.js` (corre chequeos de estructura, links, conteos, sintaxis y todas las suites de tests).
- **Conventional Commits:** `<type>(<scope>): <description>`, validado por [.githooks/commit-msg](.githooks/commit-msg).
- **Nunca hagas `git push` sin pedido explícito:** cada push a `main` despliega en Vercel.
