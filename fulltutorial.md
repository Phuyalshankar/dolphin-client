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

### ३.३. Svelte-Style Block Conditionals & Loops (कन्डिसनल र लुप ब्लकहरू)
When data arrives via HTTP API or WebSockets, Dolphin compiles your templates on-the-fly. In addition to standard double mustache (`{{key}}`) replacements, Dolphin Client v2.0 features a fully integrated **Svelte-Style Template Compiler** natively running in the browser:

- **`{#if expression}` / `{:else if expression}` / `{:else}` / `{/if}`**: Compile Svelte-style conditional flows. You can nest `{#if}` statements to arbitrary levels!
- **`{#each expression as item}`** or **`{#each expression as item, index}`**: Loop over arrays dynamically. The optional `index` variable starts at `0` and increments automatically.
- **Single Curly `{expression}` and Double Curly `{{expression}}`**: Output values safely. Dolphin resolves variable paths, nested object properties (like `user.name`), optional chaining (`?.`), and logical operators.
- **Dynamic Attribute Interpolation**: Interpolates expressions inside standard HTML attributes dynamically (e.g., `src="{user.avatar}"` or `data-api-click="POST /api/reply/{notification.id}"`).

---

### ३.३.१. Real-World Example 1: Multi-Level Nested Conditionals (User Profile Card)
This example showcases a full dynamic user profile card. It handles states like:
1. **User not logged in**: Displays login input fields.
2. **User logged in but unverified**: Displays a warning card with a verification link.
3. **User verified but not premium**: Displays their details with an upgrade call-to-action button.
4. **User verified and premium**: Highlights their status with a premium badge.

```html
<div data-api-get="/api/user/profile" 
     data-rt-template='
  <div class="profile-container">
    {#if user}
      {#if user.verified}
        <div class="profile-card fx-aurora">
          <img src="{user.avatar}" class="avatar" alt="{user.name}" />
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          
          {#if user.premium}
            <div class="premium-badge fx-neon">⭐ Premium Member</div>
            <button class="filled">Access Premium Content</button>
          {:else}
            <div class="upgrade-badge fx-glass">Upgrade to Premium</div>
            <button class="outline">View Plans →</button>
          {/if}
        </div>
      {:else}
        <div class="verify-card fx-glass">
          <h3>Verify Your Account</h3>
          <p>Check your email for verification link</p>
          <button data-api-click="POST /api/resend-verification">
            Resend Email
          </button>
        </div>
      {/if}
    {:else}
      <div class="login-card fx-glass">
        <h3>Login to Continue</h3>
        <input placeholder="Email" />
        <input type="password" placeholder="Password" />
        <button class="filled primary">Login</button>
        <a href="/register">Create Account</a>
      </div>
    {/if}
  </div>
'></div>
```

---

### ३.३.२. Real-World Example 2: List Loops with Loop Indices (Notifications Feed)
This example displays a dynamic list of real-time notifications. It automatically loops over the list, renders specific markup based on notification types (`message`, `alert`, `update`, etc.), prints the sequential loop index (`#0`, `#1`), and binds dynamic HTTP API action triggers to button clicks:

```html
<div data-rt-bind="notifications"
     data-rt-template='
  <div class="notifications-container">
    {#if notifications.length > 0}
      <div class="notifications-list">
        <h3>You have {notifications.length} notifications</h3>
        
        {#each notifications as notification, index}
          <div class="notification-item fx-glass">
            {#if notification.type === "message"}
              <div class="message-notification">
                <span class="icon">💬</span>
                <div class="content">
                  <strong>#{index} from {notification.from}</strong>
                  <p>{notification.message}</p>
                  
                  {#if notification.replyNeeded}
                    <button data-api-click="POST /api/reply/{notification.id}">
                      Reply
                    </button>
                  {:else}
                    <span class="read-status">✓ Read</span>
                  {/if}
                </div>
              </div>
              
            {:else if notification.type === "alert"}
              <div class="alert-notification fx-neon">
                <span class="icon">⚠️</span>
                <div class="content">
                  <strong>#{index} Alert!</strong>
                  <p>{notification.message}</p>
                  
                  {#if notification.action}
                    <button data-api-click="POST /api/alert/{notification.id}/action">
                      {notification.action}
                    </button>
                  {/if}
                </div>
              </div>
              
            {:else if notification.type === "update"}
              <div class="update-notification">
                <span class="icon">🔄</span>
                <div class="content">
                  <strong>Update Available (v{notification.version})</strong>
                  <p>{notification.message}</p>
                  
                  {#if notification.urgency === "major"}
                    <button class="urgent" data-api-click="POST /api/update">
                      Update Now
                    </button>
                  {:else}
                    <button data-api-click="POST /api/update/dismiss">
                      Dismiss
                    </button>
                  {/if}
                </div>
              </div>
              
            {:else}
              <div class="default-notification">
                <span class="icon">📢</span>
                <div class="content">
                  <p>{notification.message}</p>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
      
    {:else}
      <div class="no-notifications fx-glass">
        <div class="empty-icon">🔔</div>
        <h3>No new notifications</h3>
        <p>You are all caught up!</p>
      </div>
    {/if}
  </div>
'></div>
```

---

### ३.३.३. HTML Directives & Sub-bindings (डाइरेक्टिभ्स र सब-बाइन्डिङ)

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

### १०.१.२. Declarative Store Actions (`data-store-[event]`) - बिना जाभास्क्रिप्ट गणित र सर्तहरू (No-JS Calculations & Conditions)
Dolphin Client v2.0 ले सिधै HTML बाटै डेटा स्टोर अपडेट गर्ने र जस्तोसुकै जटिल गणितीय हिसाब, लजिकल अपरेटर, र सर्तहरू (conditional statements) चलाउने फिचर प्रदान गर्दछ। यसको लागि तपाईँले कुनै जाभास्क्रिप्ट फङ्सन वा `<script>` ट्याग लेख्नै पर्दैन।

तपाईँले `data-store-click`, `data-store-change` जस्ता एट्रिब्युटहरू प्रयोग गरेर सिधै HTML भित्रै जाभास्क्रिप्टका गणितीय सूत्रहरू लेख्न सक्नुहुन्छ:

#### क) गणितीय हिसाबहरू (Mathematical Calculations)
```html
<!-- दुईवटा भ्यालु स्वतः गुणन गरेर 'app.total' मा राख्न -->
<button data-store-click="app.total = app.price * app.quantity">कुल हिसाब निकाल्नुहोस्</button>

<!-- १ देखि १०० सम्मको रेन्डम नम्बर स्वतः जेनेरेट गर्न -->
<button data-store-click="app.randomNum = Math.floor(Math.random() * 100) + 1">Random Number</button>
```

#### ख) सर्त र निर्णयहरू (Conditions & Ternary Operators)
Ternary operator (`condition ? true : false`) वा बहु-लाइन `if/else` सर्तहरू सिधै HTML बाटै चल्छन्:
```html
<!-- यदि स्कोर ५० वा सोभन्दा बढी भए 'Passed' नत्र 'Failed' सेट गर्न -->
<button data-store-click="app.result = (app.score >= 50) ? 'Passed' : 'Failed'">नतिजा हेर्नुहोस्</button>

<!-- यदि काउन्ट १० भन्दा सानो भए बढाउने, नत्र ० मा फर्काउने -->
<button data-store-click="if (app.count < 10) { app.count++ } else { app.count = 0 }">Incrementor</button>
```

#### ग) अन-अफ टगल गर्ने (Boolean / Toggle Logic)
डार्क मोड अन-अफ गर्न वा कुनै स्टेटलाई स्वतः उल्टो (toggle) बनाउन:
```html
<!-- darkMode को भ्यालु true भए false र false भए true बनाउन -->
<button data-store-click="app.darkMode = !app.darkMode">डार्क मोड अन/अफ</button>
```

### १०.१.३. Declarative Store Initialization & Context Containers (`<dolphin-store>`) - स्टोर घोषणा, प्रारम्भिकरण र अटो-बाइन्डिङ

Dolphin Client v2.0 introduces the `<dolphin-store>` tag for declaring, seeding, and auto-wiring reactive stores directly in HTML without writing custom JavaScript scripts.

#### क) Seed-Only Mode (विशुद्ध डेटा सीडिङ)
If the `<dolphin-store>` tag does not contain child elements, it seeds the store and remains hidden (`display: none`). You can seed data via tag attributes or inline JSON content:

**Attribute-Based Seeding:**
```html
<!-- Automatically seeds store "app" with boolean, numeric, null, and string types -->
<dolphin-store name="app" count="0" isAdding="false" user="null" theme="dark"></dolphin-store>
```

**JSON-Based Seeding:**
```html
<!-- Seed complex objects/arrays by putting JSON content inside the tag -->
<dolphin-store name="app">
  {
    "count": 10,
    "user": { "name": "Shankar", "role": "admin" },
    "loggedIn": true
  }
</dolphin-store>
```

#### ख) Context Container Dual-Mode (डबल-मोड - डेटा कन्टेनर)
If the `<dolphin-store>` tag contains child elements, it acts as a **reactive context container** and remains visible. Its children can read and write to the store dynamically using `data-store-*` directives:

```html
<!-- Acts as the reactive container for 'store/profile' -->
<dolphin-store name="profile" username="Shankar" role="Admin">
  <div class="card">
    <h3 data-rt-text="username"></h3>
    <span class="badge" data-rt-text="role"></span>
  </div>
</dolphin-store>
```

#### ग) Template Auto-Wiring (टेम्पलेट स्वतः-कनेक्सन)
By setting the `template` attribute on a `<dolphin-store>`, Dolphin will automatically generate a reactive binding `div` right after it, compile the specified template selector, and render it with the store's seeded state immediately on page load:

```html
<!-- 1. The Svelte-style template -->
<template id="counter-ui">
  <div class="counter-box">
    <p>Count: {{count}}</p>
    <button data-rt-click="app.count = app.count + 1">Increment</button>
  </div>
</template>

<!-- 2. Auto-wire the store app to the template (No separate wrapper div required!) -->
<dolphin-store name="app" template="#counter-ui" count="5"></dolphin-store>
```
Under the hood, this dynamically injects a binding container that subscribes to `store/app` and updates the UI in real-time.

### १०.१.४. Database Store Collections & CRUD Actions in HTML (डेटाबेस स्टोर कलेक्सन र बिना जाभास्क्रिप्ट CRUD र फिल्टर्स)

Dolphin Client v2.0 ले डेटाबेस स्टोरका कलेक्सनहरूलाई (जुन स्वतः REST र WebSockets बाट सिंक हुन्छन्) सिधै HTML attributes भित्रैबाट चलाउन र व्यवस्थापन गर्न मिल्ने सुविधा प्रदान गर्दछ।

यदि कुनै `<dolphin-store>` वा dynamic database collection (जस्तै `products` वा `users`) दर्ता छ भने, तपाईँले HTML elements मा `data-store-click`, `data-store-input`, वा `data-store-change` प्रयोग गरेर सिधै ती कलेक्सनका Methods कल गर्न सक्नुहुन्छ।

कल गरेपछि Dolphin ले स्वतः DOM लाई reactive रूपमा re-render गराउँछ।

#### उपलब्ध मुख्य Collection Methods:
* **`collectionName.search(term, fields)`**: पाठ (text) खोज्नका लागि (fields array ऐच्छिक हो)।
* **`collectionName.filter(field, value)`**: कुनै निश्चित field को भ्यालुअनुसार फिल्टर गर्न।
* **`collectionName.range(field, min, max)`**: अंकहरूको सीमाअनुसार फिल्टर गर्न।
* **`collectionName.sort(field, asc)`**: कुनै फिल्डको आधारमा alphabetical वा numerical क्रममा मिलाउन (asc `true`/`false` हुन्छ)।
* **`collectionName.clearFilters()`**: सबै फिल्टर्स र सर्टिङ हटाउन।
* **`collectionName.deleteById(id)`**: आईडीको आधारमा आइटम हटाउन (DOM र database दुवैमा)।
* **`collectionName.updateById(id, updates)`**: आईडीको आधारमा आइटम अपडेट गर्न।
* **`collectionName.add(item)`**: नयाँ आइटम थप्न।

#### HTML मा प्रयोगको उदाहरण:
```html
<!-- १. डेटाबेस स्टोर कलेक्सन दर्ता गर्ने -->
<dolphin-store name="products"></dolphin-store>

<!-- २. बिना जाभास्क्रिप्ट टेक्स्ट सर्च (input event मा चल्ने) -->
<input placeholder="Search products..." data-store-input="products.search(this.value)" />

<!-- ३. विना जाभास्क्रिप्ट ड्रपडाउन फिल्टर (change event मा चल्ने) -->
<select data-store-change="products.filter('category', this.value)">
  <option value="">All Categories</option>
  <option value="electronics">Electronics</option>
  <option value="books">Books</option>
</select>

<!-- ४. मूल्यअनुसार सर्टिङ र फिल्टर क्लियर गर्ने बटनहरू -->
<button data-store-click="products.sort('price', true)">कम मूल्य पहिला</button>
<button data-store-click="products.sort('price', false)">उच्च मूल्य पहिला</button>
<button data-store-click="products.clearFilters()">फिल्टर हटाउनुहोस्</button>

<!-- ५. डाटाहरू रेन्डर गर्ने र डिलिट बटन राख्ने -->
<div data-rt-bind="store/products" data-rt-template="#product-card-template"></div>
<template id="product-card-template">
  {#each items as item}
    <div class="product-item">
      <h4>{item.name}</h4>
      <p>मूल्य: ${item.price}</p>
      <!-- सिधै HTML बाट database item delete गर्ने (DOM स्वतः अपडेट हुन्छ!) -->
      <button data-store-click="products.deleteById(item.id)">मेटाउनुहोस्</button>
    </div>
  {/each}
</template>
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

For continuous integration (CI) and automated tests, Dolphin Client v2.0 exposes a clean standalone testing bundle inside [src/testing.ts](./src/testing.ts):

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

---

## १६. Universal Backend Frameworks Integration (PHP & Node.js ब्याकइन्ड एकीकरण)

Dolphin Client comes with **native out-of-the-box support** for major backend frameworks, including PHP frameworks (CakePHP, WordPress, Laravel) and Node.js backend frameworks (Express, NestJS, Fastify). You do not need to configure any custom ajax headers or write error-handling logic—Dolphin handles it directly!

### १६.१. Automatic CSRF and Nonce Token Injection
Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) are automatically injected with security verification tokens to bypass server-side security checks:
1. **Laravel**: Automatically reads standard token `<input type="hidden" name="_token" value="...">` produced by `@csrf` or `csrf-token` meta tags.
2. **CakePHP**: Grabs `_csrfToken` hidden input fields or `csrfToken` cookies.
3. **WordPress**: Automatically retrieves security nonces from `window.wpApiSettings.nonce` or `<meta name="wp-nonce">` and injects them in `X-WP-Nonce` header.
4. **Node.js (CSRF protection)**: Reads standard `XSRF-TOKEN` or `_csrf` cookies/meta tags.

Dolphin automatically injects these tokens inside the **Request Headers** (`X-CSRF-Token`, `X-XSRF-TOKEN`, `X-WP-Nonce`) and **Request Payload** (`_csrfToken`, `_token`, `_csrf`) under the hood!

### १६.२. HTTP Method Spoofing (`_method`)
Traditional HTML forms only support `GET` and `POST`. PHP and Node.js backend routers support HTTP Method Spoofing to process `PUT`, `PATCH`, or `DELETE`.
If `methodSpoofing: true` is configured in `options`, or a hidden `<input type="hidden" name="_method" value="PUT">` is present in a form:
- Dolphin Client maps the fetch request method to a `POST`.
- Attaches the spoofed method as a request header `X-HTTP-Method-Override: PUT` and inside the payload body as `_method: "PUT"`.

### १६.३. Unified Validation Error Parsing
Different backends output validation errors in different structures. Dolphin Client includes a **Universal Error Adapter** that normalizes all formats into a flat `{ [field]: errorMessage }` object, then automatically publishes them to state `errors/{field}`:
- **Laravel / Yii Format**: `{ errors: { email: ["Must be valid email"] } }` → `errors/email` is updated.
- **CakePHP Format**: `{ errors: { email: { _required: "Email is required" } } }` → `errors/email` is updated.
- **Node.js (Joi/Yup/Express-Validator) Format**: `[ { path: "email", msg: "Invalid email" } ]` → `errors/email` is updated.

This means you can display server-side validation errors in HTML instantly with **zero JavaScript**:
```html
<form data-api-submit="POST /users/register">
  <input name="email" />
  <!-- Server-side validation errors show up here instantly! -->
  <span class="error" data-rt-bind="errors/email"></span>
</form>
```

### १६.४. Base Path & Subfolder Resolution
If your PHP/WordPress application is hosted locally under a subfolder (e.g. `http://localhost/my-wp-site/`), Dolphin Client automatically respects the `<base href="...">` or `<meta name="base-path">` tags to dynamically prefix all relative API targets (e.g., resolving `data-api-get="/api/posts"` to `http://localhost/my-wp-site/api/posts`).

---

## १७. Buildless SPA Architecture: Component Imports & Link Routing

Dolphin Client v2.0 empowers you to build pure, lightning-fast **Single Page Applications (SPAs)** using standard static HTML pages (like `home.html`, `about.html`, `product.html`) with **exactly zero lines of manual frontend JS** and **zero compiler/bundler setups!**

### १७.१. Declarative Component Layout Imports (`data-import`)
Rather than copy-pasting headers, navs, and footers across all HTML pages, you can declare layouts dynamically:
```html
<!-- index.html (Master Layout) -->
<body>
  <!-- Imports header.html into this container dynamically -->
  <div data-import="components/header.html"></div>
  
  <main id="viewport">
    <h1>Page Content</h1>
  </main>
  
  <div data-import="components/footer.html"></div>
</body>
```

#### Under the Hood:
- **Promise-Based Caching**: Multiple duplicate imports of the same component (like identical buttons or sidebars) are fetched **exactly once** from the server using concurrent promise resolution.
- **Recursive Resolution**: Imported files can safely import sub-files (e.g., `header.html` importing `nav.html`).
- **Circular Check**: Safely breaks circular locks (e.g. layout A importing layout B which imports layout A) and displays an alert.
- **Reactivity Re-scanning**: Dolphin automatically executes store and DOM binding scans on newly imported HTML components.

### १७.२. Instant SPA Viewport Router (`data-spa`)
Converts traditional page transitions into a smooth Single Page Application experience by hijacking links:
```html
<!-- Links with data-spa will route dynamically without reloads! -->
<nav>
  <a href="home.html" data-spa>Home</a>
  <a href="about.html" data-spa>About Us</a>
  <a href="product.html" data-spa>Products</a>
</nav>
```

#### Configuration Options (in constructor):
- **`routerViewport`**: Selector pointing to the container to be replaced (default: `'main, #viewport, body'`).
- **`routerTransitions`**: Enables a smooth CSS fade transition between viewport changes (default: `true`).

```javascript
const dolphin = new DolphinModule.DolphinClient(undefined, undefined, {
  routerViewport: '#viewport',
  routerTransitions: true
});
```

#### Transition Styles (automatically injected):
When navigating, Dolphin applies a fading animation by adding `.dolphin-fade-out` and `.dolphin-fade-in` to the viewport, giving your buildless static site a fluid, modern, app-like finish!

---

## १८. Direct React Integration & DolphinStore API (React र DolphinStore एपीआई एकीकरण)

Dolphin Client मा भएको **DolphinStore** ले तपाईँलाई क्लाइन्ट-साइड स्टेट र ब्याकइन्ड डेटा कलेक्सनहरू (GET API र real-time WebSocket Syncing) सजिलै व्यवस्थापन गर्न दिन्छ। यसलाई तपाईँले म्यानुअल जाभास्क्रिप्ट कोड वा **React** सँग सजिलै जोड्न सक्नुहुन्छ।

---

### १८.१. DolphinStore JS API
जब तपाईँ `DolphinClient` इन्स्टन्स सिर्जना गर्नुहुन्छ, `dolphin.store` स्वतः उपलब्ध हुन्छ। कुनै पनि कलेक्सन प्रोपर्टी (जस्तै `store.devices` वा `store.orders`) पहिलो पटक एक्सेस गर्दा, यसले:
1. **स्वचालित HTTP Fetch**: `/devices` वा `/orders` मा `GET` रिक्वेस्ट पठाउँछ।
2. **स्वचालित WebSocket Sync**: `db:sync/devices` च्यानलमा स्वतः सब्सक्राइब गर्छ र ब्याकइन्डमा कुनै आइटम `create`, `update`, वा `delete` हुँदा कलेक्सन डेटा रियल-टाइम अपडेट गर्छ।

#### क) chainable DataEngine र Filters (डेटा फिल्टरिङ, सर्च र सर्टिङ)
Dolphin v2.0 ले नयाँ chainable `DataEngine` ल्याएको छ जसले इन-मेमोरी रुपमै धेरै छिटो र प्रभावकारी फिल्टर, सर्च र सर्टिङ गर्दछ:

```javascript
const products = dolphin.store.products;

// १. Chainable search/filter/range/sort
const results = products
  .search('laptop', ['name', 'description'])  // Case-insensitive free text search
  .filter('inStock', true)                     // Exact match filter
  .range('price', 500, 1500)                   // Numeric range
  .sort('price', true);                        // Sorting (field, ascending=true)

console.log("फिल्टर गरिएका उत्पादनहरू:", results.items);

// २. Pagination (पेजिनेसन)
const pageData = products.page(1, 10); // Page 1, size 10
console.log("Page data:", pageData.data);
console.log("Total pages:", pageData.pages);
console.log("Has next page?", pageData.hasNext);

// ३. filters clear गर्ने र reset गर्ने
products.clearFilters();
```

#### ख) Optimistic UI Updates with Rollback (अप्टिमिस्टिक अपडेटहरू)
यदि तपाईँ इन्टरनेट स्लो भएको बेला वा रियल-टाइम अनुभव दिनका लागि क्लाइन्टमा डेटा तुरुन्त अपडेट (म्युटेट) गर्न चाहनुहुन्छ भने `optimisticDelete` र `optimisticUpdate` चलाउन सक्नुहुन्छ। यसले UI मा तुरुन्तै परिवर्तन देखाउँछ र ब्याकइन्ड API फेल भएमा स्वतः पहिलेकै अवस्थामा फर्काइदिन्छ (rollback):

```javascript
// १. Optimistic Delete (मेटाउने र फेल भएमा रोलब्याक गर्ने)
await dolphin.store.products.optimisticDelete(105, () => {
  return dolphin.api.delete('/products/105');
});

// २. Optimistic Update (अपडेट गर्ने र फेल भएमा रोलब्याक गर्ने)
await dolphin.store.products.optimisticUpdate(105, { price: 999 }, () => {
  return dolphin.api.put('/products/105', { price: 999 });
});
```

#### ग) Per-Item Loading State Tracking (प्रति-आइटम लोडिङ ट्र्याकिङ)
डेटाबेसका कुनै विशेष आइटमहरूमा प्रोसेसिंग (loading) हुँदैछ कि छैन भनेर जाँच गर्न प्रति-आइटम ट्र्याकिङ चलाउन सकिन्छ (उदाहरणका लागि: एउटा मात्र कार्डमा लोडिङ स्पिनर देखाउन):

```javascript
const products = dolphin.store.products;

// १. लोडिङ सुरु भएको जनाउन
products.trackStart(105);
console.log(products.isLoading(105)); // true

// २. लोडिङ समाप्त भएको जनाउन
products.trackEnd(105);
console.log(products.isLoading(105)); // false
```

#### घ) Race Condition Guards, Batching & Resource Cleanup
Dolphin v2.0 ले ब्याकइन्ड र मेमोरी व्यवस्थापनमा निम्न सुधारहरू गरेको छ:
* **Race Condition Guard**: एउटै कलेक्सन बारम्बार र एकै पटक fetch हुन खोज्दा रेसिङ हुन नदिन `_fetching` Set गार्ड राखिएको छ।
* **Batch Notification (`queueMicrotask`)**: धेरै छिटो र लगातार हुने स्टेट अपडेटहरूलाई एकै पटक ब्याच गरी DOM र ऐप्लिकेसनलाई single render cycle मा सूचित गर्दछ, जसले गर्दा UI ६०fps मा स्मूथ चल्छ।
* **Memory Leak Fixes on Destroy**: `destroy()` कल गर्दा सबै एक्टिभ WebSocket च्यानलहरू र unsubscribe handlers लाई सफा गरिन्छ।

#### ङ) म्यानुअल सब्सक्राइब (Manual Subscription & Snapshot)
```javascript
// १. स्टोरमा आउने जुनसुकै अपडेट सुन्न सब्सक्राइब गर्ने
const unsubscribe = dolphin.store.subscribe(() => {
  const currentOrders = dolphin.store.getSnapshot('orders');
  console.log("Store Updated! Orders:", currentOrders.items);
});

// २. काम सकिएपछि अनसबस्क्राइब गर्ने
unsubscribe();
```

---

### १८.२. Hookless React Integration (क्लास कम्पोनेन्टमा प्रयोग)
यदि तपाईँ React मा कुनै पनि state hooks (`useState`, `useEffect`) प्रयोग नगरी Dolphin Store सँग सिधै रियल-टाइम डेटा बाइन्ड गर्न चाहनुहुन्छ भने, **React Class Components** सबैभन्दा उत्तम विकल्प हो। यसले React लाई विशुद्ध रूपमा रेन्डरिङ इन्जिन मात्र बनाउँछ:

```jsx
import React from 'react';

class OrderDashboard extends React.Component {
  constructor(props) {
    super(props);
    // १. initial store snapshot स्टेटमा राख्ने
    this.state = {
      orders: window.dolphin.store.getSnapshot('orders')
    };
  }

  componentDidMount() {
    // २. स्टोर अपडेट हुँदा लोकल स्टेट अपडेट गर्न सब्सक्राइब गर्ने
    this.unsubscribe = window.dolphin.store.subscribe(() => {
      this.setState({
        orders: window.dolphin.store.getSnapshot('orders')
      });
    });
  }

  componentWillUnmount() {
    // ३. कम्पोनेन्ट अनमाउन्ट हुँदा अनसबस्क्राइब गर्ने
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    const { items, loading, error } = this.state.orders;

    if (loading) return <div>लोड हुँदैछ...</div>;
    if (error) return <div>त्रुटि: {error}</div>;

    return (
      <div className="orders-list">
        <h2>रियल-टाइम अर्डरहरू ({items.length})</h2>
        {items.map(order => (
          <div key={order.id} className="order-item">
            <span>अर्डर #{order.id}</span> - <span>रू. {order.amount}</span>
          </div>
        ))}
      </div>
    );
  }
}

export default OrderDashboard;
```

---

### १८.३. React Hook Integration using `useSyncExternalStore` (हूक कम्पोनेन्टमा प्रयोग)
यदि तपाईँ React 18+ को functional components प्रयोग गर्दै हुनुहुन्छ भने, React को आधिकारिक **`useSyncExternalStore`** API को प्रयोग गरेर Dolphin Store लाई विना कुनै अनावश्यक re-render वा state synchronization झन्झट सिधै हूकमा एकीकृत गर्न सक्नुहुन्छ:

```jsx
import { useSyncExternalStore } from 'react';

// custom react hook सिर्जना गर्ने
function useDolphinCollection(collectionName) {
  const store = window.dolphin.store;
  
  // १. external store subscribe गर्ने तरिका
  const subscribe = (onStoreChange) => store.subscribe(onStoreChange);
  
  // २. snapshot लिनको लागि getSnapshot
  const getSnapshot = () => store.getSnapshot(collectionName);
  
  // React ले यो स्टोर अपडेट हुँदा स्वतः कम्पोनेन्टलाई re-render गराउँछ
  return useSyncExternalStore(subscribe, getSnapshot);
}

// React component मा प्रयोग गर्दा:
export function UsersList() {
  const { items, loading, error } = useDolphinCollection('users');

  if (loading) return <p>लोड हुँदैछ...</p>;
  if (error) return <p>त्रुटि भयो: {error}</p>;

  return (
    <ul>
      {items.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

---

### १८.४. Prevent Resource Leaks with `destroy()`
जब तपाईँको सिंगल पेज वा स्टोर अब प्रयोगमा आउँदैन (जस्तै SPA navigation वा HMR/Hot Reloading को समयमा), स्टोरलाई पूर्ण रूपमा नष्ट गर्न `dolphin.store.destroy()` कल गर्नु आवश्यक हुन्छ। यसले सबै एक्टिभ WebSocket subscriptions र listeners हटाई मेमोरी लिक हुनबाट जोगाउँछ:

```javascript
// clean up dolphin store
dolphin.store.destroy();
```

---

Enjoy building hookless, lightning-fast, and premium real-time applications with **Dolphin Client**! 🐬
