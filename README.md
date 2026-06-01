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
> 📖 Read our comprehensive **[Full Developer Tutorial & Integration Guide](https://github.com/Phuyalshankar/dolphin-client/blob/main/fulltutorial.md)** for detailed guides, Next.js setups, WebRTC intercoms, global stores, drag-and-drop sortable lists, and real-world examples!

---

## Features

- **Hookless Reactivity**: Bind topics to DOM elements via HTML data attributes—no React, Vue, or Angular state management required.
- **Svelte-Style Templates Compiler**: Native browser compiler supporting Svelte-style loop blocks (`{#each ... as ...}`), multi-level nested conditionals (`{#if} / {:else if} / {:else}`), loop indices (`index`), optional chaining, and dynamic attribute interpolation.
- **Unified Event Binding**: Loop-based browser event handling for values (`data-rt-push`) and actions (`data-rt-[event]` / `data-api-[event]`).
- **Context API/Prop drilling in Pure DOM**: Crawls up the DOM tree (`getClosestContext`) to fetch parent contexts and inject parameters.
- **REST API + Realtime Hybrid Support**: Evaluates templates (`data-rt-template`) on initial HTTP fetches (`data-api-get`) and transitions seamlessly to real-time WebSockets on connection.
- **WebRTC Intercom Signaling**: Built-in methods to handle peer connections, track negotiation, ICE candidates, and signaling.
- **Ultralight weight**: Zero external dependencies, pure browser-native runtime APIs (~39KB compressed bundle!).

---

## Installation & Setup

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
> For the premium styling layer, create a `dolphin-css.css` file and add the custom effects (like `.fx-glass` and `.fx-neon`) described in the **[Full Developer Tutorial](https://github.com/Phuyalshankar/dolphin-client/blob/main/fulltutorial.md)**.

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

---

## Interactive Examples Guide

Below are clean, ready-to-use HTML examples for the core features of Dolphin Client. Because Dolphin supports **Zero-Configuration Auto-Initialization**, these will run instantly!

### 1. Real-Time (RT) Pub/Sub (Real-time Chat)
Publish inputs on typing, and display incoming messages in real-time under a WebSocket topic:

```html
<!-- Automatically publishes typed values to topic 'chat/messages' -->
<input name="chatMessage" data-rt-push="chat/messages" placeholder="Type a message..." />

<!-- Displays and appends all incoming messages under 'chat/messages' -->
<div data-rt-bind="chat/messages" data-rt-template='
  <div class="message-card">
    <span class="user-label">@user:</span>
    <p>{{chatMessage}}</p>
  </div>
'></div>
```

### 2. REST API Integration (Reactive List Loader)
Fetch data instantly via REST API on page load and compile templates dynamically:

```html
<!-- Fetches from GET /api/devices, compiles items inside #device-card-template -->
<div data-api-get="/api/devices" data-rt-template="#device-card-template">
  <!-- Loading spinner placeholder: automatically removed when data arrives! -->
  <div class="spinner">Loading devices...</div>
</div>

<!-- Browser-Native Template Tag (No quote-escaping or backticks needed!) -->
<template id="device-card-template">
  <div class="device-card">
    <h3>{{name}}</h3>
    <span class="badge">{{status}}</span>
  </div>
</template>
```

### 3. Declarative Form Validation
Apply strong validation rules to inputs and display errors directly in the UI with absolutely **zero JavaScript**:

```html
<form id="login-form" data-api-submit="POST /api/login">
  <div class="form-group">
    <input name="email" data-validate="required,email" placeholder="Your Email" />
    <!-- Automatically reads and displays validation error directly in the UI -->
    <span class="error-msg" data-rt-bind="errors/email"></span>
  </div>

  <div class="form-group">
    <input name="password" type="password" data-validate="required,min:8" placeholder="Password" />
    <span class="error-msg" data-rt-bind="errors/password"></span>
  </div>

  <button type="submit">Log In</button>
</form>
```

### 4. Global State & Declarative Store Actions (No-JS Actions!)
Manage local stores and run complex calculations, conditions, and toggles **directly in HTML attributes**:

```html
<!-- 1. Auto-sync inputs directly into store key 'app.username' -->
<input data-store-write="app.username" placeholder="Type name..." />
<h3 data-store-read="app.username"></h3>

<!-- 2. Pure HTML Mathematical Counter -->
<div class="counter-box">
  <div class="counter-value" data-store-read="app.count">0</div>
  <!-- Updates state directly in HTML click. Dolphin updates the UI dynamically! -->
  <button data-store-click="app.count = (app.count || 0) + 1">+</button>
  <button data-store-click="app.count = (app.count || 0) - 1">-</button>
</div>

<!-- 3. Complex Calculations (e.g. Area & Billing) -->
<button data-store-click="
  app.area = 3.14159 * (app.radius * app.radius);
  app.circumference = 2 * 3.14159 * app.radius
">
  Calculate Circle
</button>

<!-- 4. Logic Toggles (e.g. Dark Mode Toggle) -->
<button data-store-click="app.darkMode = !app.darkMode">Toggle Dark Mode</button>
```

### 5. Silent Zero-Configuration Auto-Initialization
When loaded via a standard `<script>` tag in browser environments, Dolphin Client automatically boots up a default client instance as `window.dolphin` on `DOMContentLoaded`.

For debugging, pass `data-debug="true"` on your script tag to turn on gorgeous, color-coded logging in your developer console for all API calls, WebSocket events, and Store updates:
```html
<script src="js/dolphin-client.js" data-debug="true"></script>
```

---

## License

ISC License
