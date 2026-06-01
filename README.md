# dolphin-client 🐬 — HTML is back!

**Hookless, framework-agnostic, zero-dependency real-time reactive DOM-binding engine.** 

Unleash the full power of modern native browser APIs and DolphinCSS without the heavy framework tax of React or Vue!

---

### 💌 Returning Home: A Love Letter to HTML

Remember the early days of your coding journey? Writing a simple `index.html` in a plain text editor, double-clicking it, and watching it open instantly in the browser. No complex build pipelines, no `node_modules` weighing hundreds of megabytes, no state hooks, and no framework fatigue. Just a direct, pure, and magical relationship between your markup and the browser.

Over the last decade, we treated HTML as a dead, passive mounting point (`<div id="root"></div>`) while building virtual universes in JavaScript. We spent 80% of our time debugging configurations and boilerplate, and only 20% building beautiful user experiences.

**Dolphin Client is our way of coming home.**

By breathing life back into standard HTML, we have resurrected the simplicity of standard markup and empowered it with the modern superpowers of WebSockets, IndexedDB, WebRTC, and hardware-accelerated CSS variables. It is the renaissance of the native web standards we all fell in love with. 

*Because the best JavaScript is actually the code you never had to write.*

---

## Documentation

> [!TIP]
> 📖 Read our comprehensive **[Full Developer Tutorial & Integration Guide](file:///c:/Users/USER/Desktop/dolphin-test/fulltutorial.md)** for detailed guides, Next.js setups, WebRTC intercoms, global stores, drag-and-drop sortable lists, and real-world examples!

---

## Features

- **Hookless Reactivity**: Bind topics to DOM elements via HTML data attributes—no React, Vue, or Angular state management required.
- **Svelte-Style Templates Compiler**: Native browser compiler supporting Svelte-style loop blocks (`{#each ... as ...}`), multi-level nested conditionals (`{#if} / {:else if} / {:else}`), loop indices (`index`), optional chaining, and dynamic attribute interpolation.
- **Unified Event Binding**: Loop-based browser event handling for values (`data-rt-push`) and actions (`data-rt-[event]` / `data-api-[event]`).
- **Context API/Prop drilling in Pure DOM**: Crawls up the DOM tree (`getClosestContext`) to fetch parent contexts and inject parameters.
- **REST API + Realtime Hybrid Support**: Evaluates templates (`data-rt-template`) on initial HTTP fetches (`data-api-get`) and transitions seamlessly to real-time WebSockets on connection.
- **WebRTC Intercom Signaling**: Built-in methods to handle peer connections, track negotiation, ICE candidates, and signaling.
- **Ultralight weight**: Zero external dependencies, pure browser-native runtime APIs (~77KB bundle!).

### Method 1: NPM (For Modern Bundlers)
```bash
npm install dolphin-client
```

### Method 2: Direct Local Download (For No-Install / Plain HTML)
Tired of the command line and `node_modules` clutter? We've got you covered!

[![Download dolphin-client.js](https://img.shields.io/badge/Download-dolphin--client.js-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://unpkg.com/dolphin-client/dist/dolphin-client.js) &nbsp;&nbsp; [![Download dolphin-client.min.js (Minified)](https://img.shields.io/badge/Download-dolphin--client.min.js-06B6D4?style=for-the-badge&logo=javascript&logoColor=white)](https://unpkg.com/dolphin-client/dist/dolphin-client.min.js) &nbsp;&nbsp; [![Download dolphin-bundle.zip](https://img.shields.io/badge/Download-dolphin--bundle.zip-4CAF50?style=for-the-badge&logo=archive&logoColor=white)](https://github.com/Phuyalshankar/dolphin-server-modules/releases/latest/download/dolphin-bundle.zip)

> [!IMPORTANT]
> **How to Download the JS Files:**
> Clicking the JS download buttons will display the raw JavaScript code in your browser. 
> To download it as a file:
> 1. **Right-click** on the yellow/blue button and select **"Save Link As..."** (or "Save Target As...").
> 2. Or, if you clicked it, press **`Ctrl + S`** (or `Cmd + S` on Mac) on the code page to save it.
> 3. Alternatively, run these commands in your terminal to download directly:
>    * **Standard (Development):**
>      ```bash
>      curl -o dolphin-client.js https://unpkg.com/dolphin-client/dist/dolphin-client.js
>      ```
>    * **Minified (Production):**
>      ```bash
>      curl -o dolphin-client.min.js https://unpkg.com/dolphin-client/dist/dolphin-client.min.js
>      ```

> [!TIP]
> **If the ZIP file download is unavailable:**
> You can clone this repository directly or copy the `dist/dolphin-client.js` (or `dist/dolphin-client.min.js`) file from your clone. 
> For the premium styling layer, create a `dolphin-css.css` file and add the custom effects (like `.fx-glass` and `.fx-neon`) described in the **[Full Developer Tutorial](file:///c:/Users/USER/Desktop/dolphin-test/fulltutorial.md)**.

Extract the zip directly inside your project folder to get a clean local directory structure with pre-bundled assets:
```
my-project/
├── css/
│   └── dolphin-css.css        (DolphinCSS Premium Visuals Layer)
├── js/
│   ├── dolphin-client.js      (Standard Reactivity Engine)
│   └── dolphin-client.min.js  (Minified Production Reactivity Engine)
└── index.html                  (A ready-to-run skeleton template!)
```
Inside your HTML, simply link them locally:
```html
<link rel="stylesheet" href="css/dolphin-css.css">
<script src="js/dolphin-client.js"></script>
```

## Basic Usage

### 1. In Modern Bundlers (Next.js, Vite, React)

```javascript
import { DolphinClient } from 'dolphin-client';

const dolphin = new DolphinClient('http://localhost:3000', 'ROOM_101');
await dolphin.connect();
```

### 2. In Plain HTML (Static / Script Tag)

```html
<script src="node_modules/dolphin-client/dist/dolphin-client.js"></script>
<script>
  const dolphin = new DolphinModule.DolphinClient('http://localhost:3000', 'ROOM_101');
  dolphin.connect();
</script>
```

## HTML Directives

### Pushing value changes
```html
<input name="chat" data-rt-push="chat/messages/ROOM_101" placeholder="Type..." />
```

### Directives & Templates
```html
<div data-api-get="/api/devices" data-rt-bind="devices/online" data-rt-template='
  <div data-rt-type="context">
    <h3>{{id}}</h3>
    <button onclick="dialPeer(&apos;{{id}}&apos;)">Dial</button>
  </div>
'></div>
```

### State Directives & Declarative Actions (New!)
Manage local numeric/text states and run complex logic (math, conditions, logical toggles) **entirely inside HTML** with absolutely **zero custom JavaScript**:

```html
<!-- 1. Auto-sync inputs directly into store key -->
<input data-store-write="app.username" placeholder="Type name..." />

<!-- 2. Auto-read and display the store key in real-time -->
<span data-store-read="app.username"></span>

<!-- 3. Declarative Action: increment/decrement counter on click -->
<button data-store-click="app.count = (app.count || 0) + 1">+</button>
<div data-store-read="app.count">0</div>
<button data-store-click="app.count = (app.count || 0) - 1">-</button>

<!-- 4. Declarative Action: toggle boolean (e.g. Dark Mode) -->
<button data-store-click="app.darkMode = !app.darkMode">Toggle Dark Mode</button>
```

### Zero-Configuration Auto-Initialization
When loaded via a standard `<script>` tag in browser environments, Dolphin Client automatically boots up a default client instance as `window.dolphin` on `DOMContentLoaded`. This means you can build fully reactive pages with absolutely **zero lines of script tags**!

## License

ISC License
