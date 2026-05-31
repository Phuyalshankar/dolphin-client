# Dolphin Client 🐬 - Full Developer Tutorial & Integration Guide

Welcome to the comprehensive guide for **Dolphin Client**, the ultimate hookless, framework-agnostic real-time reactive DOM-binding library. 

This tutorial will teach you how to build modern, lightweight, real-time web applications (including WebSockets, REST APIs, and WebRTC Intercom Calling) using **pure HTML, CSS, and Dolphin Client—with ZERO lines of React/Vue/Angular state management code!**

---

## १. Introduction & Hookless Architecture (परिचय र वास्तुकला)

In traditional frontend development (React, Next.js, Vue), syncing real-time data with the UI requires heavy state management hooks (`useState`, `useEffect`, `useSyncExternalStore`), virtual DOM diffing, and complex component lifecycles.

**Dolphin Client** completely eliminates this framework fatigue through **Direct DOM Reactivity**:
- **HTML-First Declarative Bindings**: Bind real-time data topics to HTML elements using standard `data-rt-*` and `data-api-*` attributes.
- **Micro-Templates**: Write dynamic HTML lists directly inside `data-rt-template` attributes.
- **DOM-Context Drilling (`getClosestContext`)**: Instead of passing props down manually (prop drilling), child elements dynamically crawl *up* the DOM tree to extract parent data.
- **Framework Agnostic**: Works perfectly in Next.js Server Components, static HTML files, WordPress, jQuery, or any legacy web portal.

---

## २. Installation (इन्स्टलेसन)

Install the standalone package via NPM:

```bash
npm install dolphin-client
```

### Script Tag Integration (Browser-Native IIFE)
For static websites or plain HTML files, copy `node_modules/dolphin-client/dist/dolphin-client.js` and load it via a script tag:

```html
<script src="dist/dolphin-client.js"></script>
<script>
  // Access through the global DolphinModule namespace
  const dolphin = new DolphinModule.DolphinClient('http://localhost:3000', 'ROOM_101');
  dolphin.connect();
</script>
```

---

## ३. Core HTML Directives Guide (HTML डाइरेक्टिभ्स निर्देशिका)

Dolphin Client automatically scans your HTML document and binds interactive listeners and real-time streams based on custom attributes.

### ३.१. Values & Event Pushes (`data-rt-push`)
Pushes the inputs of form elements to a WebSocket topic. It automatically registers unified listeners on `['input', 'change', 'keyup', 'paste', 'blur']` to ensure robust value sync across all interactions (typing, select dropdown changes, copying/pasting).

```html
<!-- Automatically publishes input values in real-time to the chat topic -->
<input name="chat" data-rt-push="chat/messages/ROOM_101" placeholder="Type a message..." />
```

### ३.२. Unified Interaction Bindings (`data-rt-[event]` and `data-api-[event]`)
Allows triggering realtime publishes or HTTP API requests on **any** standard browser event (`click`, `change`, `keydown`, `keyup`, `dblclick`, `focus`, `blur`, `mouseenter`, `mouseleave`).

```html
<!-- Publishes payload on double click -->
<div data-rt-dblclick="sensor/trigger" data-rt-payload='{"status": "alert"}'>Double Click Me</div>

<!-- Triggers an API request on select dropdown change -->
<select data-api-change="POST /api/settings" data-api-payload='{"theme": "dark"}' data-api-result="settings/status">
  <option value="dark">Dark Theme</option>
  <option value="light">Light Theme</option>
</select>
```

### ३.३. HTML Templates & Directives
When data arrives via HTTP API or WebSockets, Dolphin compiles templates on-the-fly and binds sub-attributes.

- **`data-rt-bind`**: Listens to a real-time topic or HTTP result.
- **`data-rt-template`**: Multi-line template. Handles both single objects and arrays (automatically loops lists without `.map()`).
- **`data-rt-text`**: Injects property as safe textContent.
- **`data-rt-html`**: Injects property as innerHTML.
- **`data-rt-attr`**: Binds values to custom attributes, format: `attrName:key,attrName2:key2`.
- **`data-rt-class`**: Toggles classes, format: `className:key`.
- **`data-rt-if` / `data-rt-hide`**: Conditional display (show/hide).

```html
<div data-api-get="/api/devices" data-rt-bind="devices/online" data-rt-template='
  <div data-rt-type="context" class="card">
    <span class="status-dot" data-rt-class="bg-emerald-400:isOnline,bg-red-400:isOffline"></span>
    <h3 data-rt-text="id"></h3>
    <img data-rt-attr="src:avatarUrl,alt:id" class="avatar" />
    <button onclick="dialPeer(&apos;{{id}}&apos;)">Call</button>
  </div>
'></div>
```

### ३.४. Browser-Native Template Tags (No Backticks!)
To completely avoid multi-line strings, backticks (\`...\`), and quote-escaping issues in your HTML attributes, you can point `data-rt-template` directly to a standard browser-native **`<template>` tag selector**:

1. **On your binding container**: Point `data-rt-template` to the CSS ID selector of your template element (e.g. `#device-card`).
2. **In your HTML body**: Declare a standard `<template>` tag. It will not render on page load, but Dolphin Client will automatically query it and instantiate it dynamically!

```html
<!-- 1. Binding Container points to the template selector (Zero Backticks!) -->
<div data-api-get="/api/devices" data-rt-bind="devices/online" data-rt-template="#device-card"></div>

<!-- 2. Browser-Native Template Tag with perfect syntax-highlighting -->
<template id="device-card">
  <div data-rt-type="context" class="card">
    <span class="status-dot" data-rt-class="bg-emerald-400:isOnline,bg-red-400:isOffline"></span>
    <h3 data-rt-text="id"></h3>
    <img data-rt-attr="src:avatarUrl,alt:id" class="avatar" />
    <button onclick="dialPeer(&apos;{{id}}&apos;)">Call</button>
  </div>
</template>
```

Benefits:
- **Clean Code**: No complex escaping or template literal backticks in HTML attributes.
- **IDE Support**: Full HTML syntax highlighting and autocomplete inside standard `<template>` tags in modern text editors (VS Code, Cursor).

---

## ४. Parent-Child Context Propagation (`getClosestContext`)

When rendering lists dynamically inside templates, child components (like a click button) often need access to their parent's specific item context (like the item `id` or `price`).

In Dolphin, you declare **`data-rt-type="context"`** on the parent container. The rendering engine stores the data object directly on the DOM element (`element._rtContext = payload`).

When an event triggers on a child element, Dolphin's **`getClosestContext(childElement)`** traverses up the DOM tree (`current = current.parentElement`) to fetch the nearest parent context and dynamically replaces mustaches (`{{variable}}`):

```html
<div data-rt-bind="store/books" data-rt-template='
  <!-- Parent Context Node -->
  <div data-rt-type="context" class="book-row">
    <h3>{{title}}</h3>
    <!-- Child trigger climbs up to parent context to resolve {{price}} -->
    <button data-api-click="POST /api/cart/add" data-api-payload='{"item": "{{title}}", "price": {{price}}}'>
      Buy for ${{price}}
    </button>
  </div>
'></div>
```

---

## ५. REST + Realtime Hybrid Loading (Offline-First)

A major breakthrough in Dolphin Client is **Hybrid REST + Realtime Binding**. It solves the problem where a web page appears empty or broken before the WebSocket (`rt`) connects.

If an element has **both** `data-api-get` and `data-rt-bind`:
1. **Initial HTTP Fetch (REST Mode)**: On page load, `data-api-get` fetches initial data from the HTTP API. Dolphin immediately routes the HTTP JSON response through the template renderer (`_updateDOM`), rendering fully compiled HTML instantly.
2. **WebSocket Takeover (Realtime Mode)**: As soon as the WebSocket connects, any real-time update published to the topic will seamlessly overwrite and update the HTML in real-time.

```html
<!-- Loads instantly from REST API, updates instantly via WebSockets! -->
<div data-api-get="/api/devices" data-rt-bind="devices/online" data-rt-template="..."></div>
```

---

## ६. Next.js Integration Guide for 100% Pure SEO

Next.js Server Components are rendered on the server into pure HTML, which is crucial for full SEO. However, React usually requires `"use client"` for dynamic reactivity. 

Using **Dolphin Client**, you can build a highly dynamic Next.js application with **ZERO `"use client"` directives**, achieving **100% full SEO score!**

### Step 1: Create a Next.js Server Component (NO `"use client"`)
Create `app/intercom/page.js`. Fetch the initial data on the server and render the markup with `data-rt-template`:

```jsx
// app/intercom/page.js
import Script from 'next/script';

async function fetchInitialDevices() {
  const res = await fetch('http://localhost:3000/api/devices', { cache: 'no-store' });
  const data = await res.json();
  return data.devices || [];
}

export default async function IntercomPage() {
  const initialDevices = await fetchInitialDevices();

  return (
    <div className="container">
      <h1>Dolphin Intercom Console</h1>
      
      {/* 1. Renders statically on the server so search engines see it instantly for SEO! */}
      <div id="online-directory" data-rt-bind="devices/online" data-rt-template='
        <div data-rt-type="context" class="card">
          <span class="status-dot"></span>
          <span class="id-label">{{id}}</span>
          <button onclick="window.dialPeer(&apos;{{id}}&apos;)" class="btn">Call</button>
        </div>
      '>
        {/* Server-Side Pre-rendering for search crawlers */}
        {initialDevices.map(device => (
          <div key={device.id} data-rt-type="context" className="card">
            <span className="status-dot"></span>
            <span className="id-label">{device.id}</span>
            <button className="btn">Call</button>
          </div>
        ))}
      </div>

      {/* 2. Load Dolphin Client statically in the browser */}
      <Script src="/node_modules/dolphin-client/dist/dolphin-client.js" strategy="afterInteractive" />
      <Script src="/init-intercom.js" strategy="afterInteractive" />
    </div>
  );
}
```

### Step 2: Initialize Intercom client-side (`public/init-intercom.js`)
Create the initialization script in your public folder to configure WebSockets and WebRTC when the browser loads:

```javascript
// public/init-intercom.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof DolphinModule === 'undefined') return;

  const serverIP = window.location.hostname;
  const deviceId = 'ROOM_101'; // Compute dynamically if needed

  // Initialize client (auto-scans DOM and registers bindings!)
  const dolphin = new DolphinModule.DolphinClient(`http://${serverIP}:3000`, deviceId);
  window.dolphin = dolphin;

  dolphin.connect().then(() => {
    console.log("WebSocket connected. Handshaking signaling...");
    
    // Subscribe to online device status presence
    dolphin.subscribe('devices/status', (payload) => {
      if (payload && payload.devices) {
        dolphin._updateDOM('devices/online', payload.devices);
      }
    });
  });
});
```

---

## ७. WebRTC Intercom Signaling APIs (वेबआरटिसी कलिङ एपीआई)

Dolphin Client has built-in signaling mechanisms for high-performance WebRTC peer connection pipelines.

### ७.१. Setting Up Peer Connection & Handshake
Here is the clean JS setup to dial and establish an audio/video call using standard signaling:

```javascript
let localStream = null;
let peerConnection = null;

async function dialPeer(peerId) {
  // 1. Capture local audio/video with robust fallback (handles missing webcams/mics)
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  } catch {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); // Audio only
    } catch {
      console.warn("No hardware capture devices available");
    }
  }

  // 2. Initialize Peer Connection
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // 3. Add local tracks
  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  } else {
    // Add receive-only transceivers if local hardware is missing
    peerConnection.addTransceiver('audio', { direction: 'recvonly' });
    peerConnection.addTransceiver('video', { direction: 'recvonly' });
  }

  // 4. Handle ICE Candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal(peerId, 'ICE_CANDIDATE', { candidate: event.candidate });
    }
  };

  // 5. Play Remote Audio/Video Track with Autoplay bypass
  peerConnection.ontrack = (event) => {
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.play().catch(e => console.error("Autoplay blocked:", e));
    }
  };

  // 6. Create SDP Offer & Publish Signaling
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  sendSignal(peerId, 'INVITE', { sdp: offer.sdp });
}

}

function sendSignal(to, type, data) {
  window.dolphin.publish(`phone/signaling/${to}`, {
    from: window.dolphin.deviceId,
    to,
    type,
    data,
    timestamp: Date.now()
  });
}
```

---

## ८. Virtual DOM Reconciliation & RAF Batched Updates (भर्चुअल DOM र ब्याच अपडेट्स)

To ensure maximum performance and maintain UI state (like input focus, text selection, and active input cursors) during high-frequency real-time updates, Dolphin Client v2.0 features an automatic, zero-dependency **Virtual DOM Diffing engine** (`diffDOM` & `patchDOM`):

- **Automatic Selective Patching**: When new data arrives, Dolphin compiles the template in memory, diffs it against the live DOM, and selectively updates only the modified text, attributes, or nodes instead of wiping the entire container.
- **60fps Batched Updates (`scheduleDOMUpdate`)**: High-frequency writes are automatically debounced and batched into browser `requestAnimationFrame` render cycles, completely preventing layout thrashing and stutter.

---

## ९. Offline-First Cache & Persistent Mutation Queue (अफ्लाइन-फर्स्ट र सूचिकृत म्यूटेशन)

Dolphin Client comes with a native offline-first persistence engine driven by **IndexedDB API**:

- **GET Requests Caching**: Successful HTTP GET requests (`data-api-get`) are cached automatically in IndexedDB. If the network goes down, Dolphin serves the last cached value instantly.
- **Offline Writes Queue**: Form submissions, API clicks, and writes (`POST`, `PUT`, `DELETE`) executed while offline are queued securely in IndexedDB and resolved with a positive mock response.
- **Automatic Sync Engine**: Once the client reconnects, the sync engine automatically flushes the queue sequentially, triggering conflict callbacks if necessary.

---

## १०. Global Reactive Stores & Declarative Form Validation (ग्लोबल स्टोर र स्वचालित फारम प्रमाणीकरण)

Dolphin Client v2.0 provides an elegant, hookless state management and form validation system:

### १०.१. State Directives (`data-store`)
Manage client-side global reactive stores without writing custom scripts:

```html
<!-- Initialize/bind an input to automatically write to store "user" at key "name" -->
<input data-store-write="user.name" placeholder="Enter your name" />

<!-- Bind an element to display the name from the store in real-time -->
<span data-store-read="user.name"></span>
```

### १०.२. Declarative Validations (`data-validate`)
Apply robust validation rules to inputs and forms instantly. Tagged invalid inputs automatically receive `.invalid` classes and publish error text:

- **`required`**: Checks for non-empty input.
- **`email`**: Validates standard email address formats.
- **`min:N`**: Enforces a minimum length of N characters.
- **`match:inputName`**: Compares value (e.g. for Password Confirmations).

```html
<form id="signup-form">
  <!-- Validates in real-time on keypress/blur and outputs error to topic errors/email -->
  <input name="email" data-validate="required,email" placeholder="Your Email" />
  
  <input name="password" type="password" data-validate="required,min:8" placeholder="Password" />
  <input name="confirm" type="password" data-validate="match:password" placeholder="Confirm Password" />
  
  <button type="submit">Sign Up</button>
</form>
```

---

## ११. Animations, Accessibility (a11y), and Internationalization (i18n)

Dolphin Client incorporates built-in UI polish tools to make apps fluid, accessible, and global:

### ११.१. Staggered Animations
Trigger animations on lists automatically using the Web Animations API:

```javascript
// Add fluid staggers to list containers easily
dolphin.staggerListItems(document.getElementById('list-container'), '.item-class', 50);
```

### ११.२. Automated Accessibility (a11y)
Easily implement accessible widgets and focus traps:

- **Modal Trap (`data-rt-a11y-focus-trap`)**: Confines `Tab` keyboard focus inside the visible modal container.
- **Keyboard List Navigation (`data-rt-keynav`)**: Enables users to traverse lists using `ArrowUp` / `ArrowDown` and click using `Enter`.
- **`autoAriaModal(el, isOpen)`**: Dynamically sets `role="dialog"`, `aria-modal="true"`, and `aria-hidden` tags.

```html
<!-- Modal box equipped with focus trap and keyboard accessibility -->
<div id="settings-modal" data-rt-a11y-focus-trap data-rt-keynav tabindex="-1">
  <button class="close-btn">Close</button>
  <ul class="options-list">
    <li tabindex="0" class="active">Dark Mode</li>
    <li tabindex="0">Light Mode</li>
  </ul>
</div>
```

### ११.३. Dynamic Translation Engine (i18n)
Provide multi-language dictionary translations seamlessly. Dotted nested keys (e.g. `auth.login`) and JSON interpolation parameter injection are fully supported:

```html
<!-- Embed dictionary data directly in HTML -->
<script type="application/json" data-i18n-dict="en">
  {
    "welcome": "Hello {{name}}! Welcome back.",
    "auth": { "login": "Log In" }
  }
</script>

<script type="application/json" data-i18n-dict="ne">
  {
    "welcome": "नमस्ते {{name}}! स्वागत छ।",
    "auth": { "login": "लग-इन" }
  }
</script>

<!-- Render translations automatically -->
<h1 data-i18n-key="welcome" data-i18n-params='{"name": "Ram"}'></h1>
<button data-i18n-key="auth.login"></button>

<!-- Switch languages dynamically on click -->
<button data-i18n-switch="ne">नेपाली</button>
<button data-i18n-switch="en">English</button>
```

---

## १२. Drag-and-Drop, Sortable Lists, and Real-time Collaboration (CRDT)

Build multi-player collaborative interfaces declarative:

### १२.१. Declarative Drag & Drop
Move items between sections and sync updates across devices instantly:

```html
<!-- Draggable Card publishes payload to WS -->
<div data-drag='{"id": 105, "title": "Buy milk"}' draggable="true">Card Item</div>

<!-- Drop Zone accepts draggable data and publishes to "tasks/moved" topic -->
<div data-drop="tasks/moved">Drop Here</div>
```

### १२.२. Sortable Lists
Drag to reorder lists in real-time. Dolphin automatically calculates elements midpoints during `dragover`, reorganizes children, and publishes the new index orders:

```html
<!-- Sortable container publishes new order map to "tasks/order" -->
<ul data-sortable="tasks/order">
  <li data-drag='{"id": 1}' draggable="true">Task A</li>
  <li data-drag='{"id": 2}' draggable="true">Task B</li>
  <li data-drag='{"id": 3}' draggable="true">Task C</li>
</ul>
```

### १२.३. Collaborative Cursor Sharing & CRDT Document Sync
Broaden your app into a cooperative space:

- **Shared Mouse Cursors (`data-rt-cursor-share`)**: Automatically tracks mouse movements relative to a container, publishes cursor ratio coordinates, and draws colored cursor circles for remote users.
- **Typing Indicators (`data-rt-typing`)**: Broadcasts typing statuses in real-time.
- **Vector Clock CRDT Sync (`data-rt-crdt`)**: Resolves concurrent writing conflicts on text inputs using timestamps while preserving caret focus selections.

```html
<!-- Real-time Collaborative Board with cursors and typing indicator -->
<div data-rt-cursor-share="room_1" class="board-canvas">
  <input data-rt-typing="room_1" placeholder="Typing indicator active..." />
  
  <!-- Collaborative CRDT synced textarea -->
  <textarea data-rt-crdt="shared_doc" placeholder="Type here concurrently..."></textarea>
</div>
```

---

## १३. Standalone Testing Utilities (DolphinTestUtils)

For continuous integration (CI) and automated tests, Dolphin Client v2.0 exposes a clean standalone testing bundle inside [src/testing.ts](file:///C:/Users/USER/Desktop/dolphin-test/src/testing.ts):

- **`DolphinTestUtils.mockWebSocket()`**: Injects a high-fidelity WebSocket mock constructor that captures outbound payloads into `sentMessages`, mimics connection state transitions, and manages message broadcasting.
- **Event Simulators**: Programmatically trigger `click` and `change` inputs to test DOM directives in Node.js/Jest environments with zero headless browser requirements.

```javascript
const { DolphinTestUtils } = require('dolphin-client/dist/testing');

// Mock standard WebSocket environment cleanly
const mockWS = DolphinTestUtils.mockWebSocket();

// Trigger connection opening
mockWS.onopen();

// Validate published messages
dolphin.publish('test/topic', { ok: true });
expect(mockWS.sentMessages).toContain(JSON.stringify({ topic: 'test/topic', payload: { ok: true } }));
```

---

## १४. Styling with DolphinCSS - Premium Aesthetics (DolphinCSS सँग स्टाइलिङ)

To make your hookless real-time applications look breathtakingly premium and modern, you can seamlessly combine **Dolphin Client v2.0** with **DolphinCSS**, our advanced visual-first CSS utility framework. 

DolphinCSS replaces the need to write dozens of Tailwind utility classes by exposing pre-built global components, neon glows, and gorgeous modern effects out-of-the-box.

### १४.१. Integration Setup
Import the DolphinCSS stylesheet directly inside your browser index or main entrypoint:

```html
<!-- Import DolphinCSS stylesheet for world-class styling -->
<link rel="stylesheet" href="path/to/dolphincss/dolphin-css.css">
```

### १४.२. Premium Visual Effects (`fx-*`)
Combine these high-end visual decorators on any card, dialog, input, or container:
- **`fx-glass`**: Classic frosted glassmorphism with dynamic backdrop blur.
- **`fx-crystal`**: Ultra-clear crystalline border with inner shadows.
- **`fx-neon`**: Cyberpunk glowing borders and drop shadows.
- **`fx-aurora`**: Frosted northern-lights color depth gradient.
- **`fx-float`**: Smooth 3D floating animation on hover.

### १४.३. Building a Reactive, Glowing DolphinCSS Card Component
Here is a complete, real-world example of how to build a stunning, frosted-glass profile card that updates reactively in real-time via WebSockets:

```html
<!-- Loads profile instantly from REST, updates instantly via WebSocket topic "user/profile" -->
<div 
  data-api-get="/api/profile" 
  data-rt-bind="user/profile" 
  data-rt-template='
    <div data-rt-type="context" class="fx-glass card p-8 border border-white/20 rounded-2xl max-w-sm hover-jelly transition-all duration-300 relative overflow-hidden">
      <!-- Glow background decoration -->
      <div class="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full blur-2xl"></div>
      
      <!-- Profile Header -->
      <div class="flex-left gap-4 mb-4 relative z-10">
        <div class="w-16 h-16 rounded-full border-2 border-primary-400 overflow-hidden shadow-lg p-0.5">
          <img data-rt-attr="src:avatarUrl,alt:name" class="w-full h-full rounded-full object-cover" />
        </div>
        <div>
          <h3 data-rt-text="name" class="text-xl font-bold text-white m-0"></h3>
          <p data-rt-text="role" class="text-primary-300 text-sm font-medium"></p>
        </div>
      </div>
      
      <!-- Bio Description -->
      <p data-rt-text="bio" class="text-white/70 text-sm leading-relaxed mb-6 relative z-10"></p>
      
      <!-- Actions Section -->
      <div class="flex-between relative z-10">
        <div class="flex gap-2">
          <span class="px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/90">Dolphin</span>
          <span class="px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/90">React-Less</span>
        </div>
        <!-- Pulsing glowing green success action button -->
        <button class="circle filled success-500 text-white p-2 glow glow-pulse hover:scale-110 transition-all flex-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  '
></div>
```

By marrying the **reactive strength of Dolphin Client** with the **premium design aesthetics of DolphinCSS**, you can build state-of-the-art, lightning-fast interfaces that look premium and responsive.

---

## १५. Production Best Practices (उत्कृष्ट अभ्यासहरू)

- **Strict Environment Security**: During native app packaging, always map standard Android/iOS run-time device permissions. Native apps do not suffer from browser HTTP context locks!
- **Auto Reconnect Policy**: Dolphin Client has an exponentional backoff reconnect strategy built-in. Set `maxReconnect` options to customize connection retry budgets.
- **Graceful Hardware Fallbacks**: Always test your WebRTC systems with receive-only transceivers (`recvonly`) so desktop terminals with no microphoness/cameras can still receive and play signals properly.

Enjoy building hookless, lightning-fast, and premium real-time applications with **Dolphin Client**! 🐬
