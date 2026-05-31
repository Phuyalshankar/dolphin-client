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

[![Download dolphin-client.js](https://img.shields.io/badge/Download-dolphin--client.js-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://unpkg.com/dolphin-client/dist/dolphin-client.js) &nbsp;&nbsp; [![Download dolphin-bundle.zip](https://img.shields.io/badge/Download-dolphin--bundle.zip-4CAF50?style=for-the-badge&logo=archive&logoColor=white)](https://github.com/Phuyalshankar/dolphin-server-modules/releases/latest/download/dolphin-bundle.zip)

*(Right-click on **dolphin-client.js** and select "Save Link As..." to save it directly to your project)*


Extract the zip directly inside your project folder to get a clean local directory structure with pre-bundled assets:
```
my-project/
├── css/
│   └── dolphin-css.css   (DolphinCSS Premium Visuals Layer)
├── js/
│   └── dolphin-client.js  (Dolphin Reactivity Engine)
└── index.html             (A ready-to-run skeleton template!)
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

## License

ISC License
