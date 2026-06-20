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

- **Universal Backend Compatibility**: Native out-of-the-box support for PHP (Laravel, CakePHP, WordPress) and Node.js (Express, NestJS, Fastify). Auto-extracts/injects CSRF tokens and nonces, normalizes multi-format validation error payloads directly into reactive forms, and supports HTTP method spoofing (`_method`) and subfolder base URLs automatically.
- **HTML Component Imports (`data-import`)**: Declaratively import reusable layouts (e.g. `header.html`, `footer.html`) dynamically in pure HTML with robust concurrent promise caching, nested rendering, and circular dependency checks.
- **Instant SPA Viewport Router (`data-spa`)**: Converts static pages into highly responsive Single Page Applications (SPAs) with zero manual JS. High-jacks links, swaps viewports dynamically with smooth fading transitions, and updates page titles and history navigation (`popstate`).
- **Hookless Reactivity**: Bind topics to DOM elements via HTML data attributes—no React, Vue, or Angular state management required.
- **Svelte-Style Templates Compiler**: Native browser compiler supporting Svelte-style loop blocks (`{#each ... as ...}`), multi-level nested conditionals (`{#if} / {:else if} / {:else}`), loop indices (`index`), optional chaining, and dynamic attribute interpolation.
- **Unified Event Binding**: Loop-based browser event handling for values (`data-rt-push`) and actions (`data-rt-[event]` / `data-api-[event]`).
- **Context API/Prop drilling in Pure DOM**: Crawls up the DOM tree (`getClosestContext`) to fetch parent contexts and inject parameters.
- **REST API + Realtime Hybrid Support**: Evaluates templates (`data-rt-template`) on initial HTTP fetches (`data-api-get`) and transitions seamlessly to real-time WebSockets on connection.
- **WebRTC Intercom Signaling**: Built-in methods to handle peer connections, track negotiation, ICE candidates, and signaling.
- **DolphinStore JS API & React Integration**: Programmatic store query, filtering (`where`), sorting (`orderBy`), and live collection syncing with auto-REST/WS fallback. Integrates seamlessly with React (class or hook components) using native external store subscriptions.
- **Ultralight weight**: Zero external dependencies, pure browser-native runtime APIs (~47KB compressed bundle!).

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

## 🧠 VS Code Autocomplete (IntelliSense)

Get instant HTML attribute suggestions for all Dolphin Client attributes (`data-api-get`, `data-rt-click`, `data-store-write`, etc.) directly inside VS Code!

### For NPM Users
Autocomplete is set up **automatically** when you install:
```bash
npm install dolphin-client
```
That's it! Reload VS Code window (`Ctrl + Shift + P` → `Developer: Reload Window`) and start typing `data-` to see suggestions.

### For CDN / Direct Download Users
Run this **one-time command** inside your project folder:
```bash
npx dolphin-client
```

This will automatically generate `.vscode/settings.json` and `.vscode/dolphin-tags.json` in your project, enabling full HTML attribute autocomplete in VS Code.

> [!TIP]
> After running the command, reload VS Code (`Ctrl + Shift + P` → `Developer: Reload Window`) to activate autocomplete. You only need to run this **once per project**!

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
Manage local stores, calculate math, toggle boolean logic, and run database collection operations **directly in HTML attributes**:

#### UI State Management:
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

<!-- 3. Complex Calculations & Toggles -->
<button data-store-click="app.area = 3.14159 * (app.radius * app.radius)">Calculate Area</button>
<button data-store-click="app.darkMode = !app.darkMode">Toggle Dark Mode</button>
```

#### Database Store CRUD & Filters (New in v2.0!):
```html
<!-- 1. Initialize or sync the database collection -->
<dolphin-store name="products"></dolphin-store>

<!-- 2. Search and filter the collection directly from HTML inputs -->
<input placeholder="Search products..." data-store-input="products.search(this.value)" />

<select data-store-change="products.filter('category', this.value)">
  <option value="">All Categories</option>
  <option value="electronics">Electronics</option>
</select>

<!-- 3. Trigger sorting or reset filters -->
<button data-store-click="products.sort('price', false)">Sort by Price Desc</button>
<button data-store-click="products.clearFilters()">Reset</button>

<!-- 4. Execute database mutations and display list (Rendered automatically without #each!) -->
<div data-rt-bind="store/products" data-rt-template="#product-item"></div>

<!-- Since the template has no {#each} block, Dolphin automatically detects the items/list array inside the store payload and repeats this template for each element! -->
<template id="product-item">
  <div class="product-card">
    <span>{{name}}</span>
    <span>${{price}}</span>
    <button data-store-click="products.deleteById(id)">Delete</button>
  </div>
</template>
```

### 4.5. SPA Viewport Router Error Clearing (New in v2.0!)
When transitioning pages in Single Page Applications (SPA), Dolphin automatically resets all stale validation errors in the `errors` store to `null`, ensuring you always start with clean validation forms on new page loads.

### 4.6. Flexible Token Parsing in SPA Hash Routing
Dolphin's authentication helper modules can parse credentials and reset-password tokens from both standard search parameters (`?token=...`) and SPA hash-routing query parameters (`#/components/reset-password.html?token=...`) seamlessly.

### 5. JavaScript Store API & React Integration
Query and filter dynamic database collections programmatically in JS, run optimistic updates, track loading state, or sync with React with zero state hooks:

```javascript
// Access the reactive store (auto-fetches GET /users and subscribes to WS db:sync/users)
const users = dolphin.store.users;

// 1. DataEngine chainable filtering, text search, ranges, and sorting (New in v2.0)
const results = users
  .search('admin', ['role', 'name'])
  .filter('active', true)
  .range('age', 18, 65)
  .sort('name', true); // asc=true

console.log("Filtered users:", results.items);

// 2. Pagination (New in v2.0)
const pageData = users.page(1, 10); // Page 1, size 10
console.log(`Page ${pageData.page} of ${pageData.pages}`, pageData.data);

// 3. Optimistic Updates with Rollback (New in v2.0)
// Updates the UI instantly, calls API, and automatically rolls back if API fails
await users.optimisticUpdate(101, { status: 'suspended' }, () => {
  return dolphin.api.put('/users/101', { status: 'suspended' });
});

// 4. Per-Item Loading State Tracking (New in v2.0)
users.trackStart(101); // Mark user 101 as processing
console.log(users.isLoading(101)); // true
users.trackEnd(101); // Remove from tracking

// 5. Subscribe to store changes manually
const unsubscribe = dolphin.store.subscribe(() => {
  console.log("Store updated, current users:", users.items);
});

// Clean up when no longer needed to prevent memory leaks (WS unsubscribe fix)
dolphin.store.destroy();
```

### 6. Silent Zero-Configuration Auto-Initialization
When loaded via a standard `<script>` tag in browser environments, Dolphin Client automatically boots up a default client instance as `window.dolphin` on `DOMContentLoaded`.

For debugging, pass `data-debug="true"` on your script tag to turn on gorgeous, color-coded logging in your developer console for all API calls, WebSocket events, and Store updates:
```html
<script src="js/dolphin-client.js" data-debug="true"></script>
```

---

## License

ISC License
