# डल्फिन क्लाइन्ट पूर्ण विकासकर्ता ट्युटोरियल (Dolphin Client Full Developer Tutorial) 🐬

डल्फिन क्लाइन्ट (`dolphin-client`) मा यहाँलाई स्वागत छ! यो ट्युटोरियलमा हामी डल्फिन क्लाइन्टको प्रयोग गरेर बिना कुनै जटिल फ्रेमवर्क (जस्तै React, Vue वा Angular) सादा HTML, CSS र JS बाटै सुपर-फास्ट, रियाक्टिभ र रियल-टाइम वेब एपहरू कसरी बनाउने भन्ने कुरा **सुरु देखि अन्तिम सम्म नेपालीमा सिक्नेछौँ**।

यो दस्तावेजमा प्रत्येक फिचर, डेटा बाइन्डिङ, ऑल-इन-वन **`<dolphin-store>`** इन्जिन, डिक्लेरेटिभ फिल्टर/सर्च/सोर्टिङ, र हालै थपिएका **Auto-Persistence & Reset** सहित सबै कोडहरू विस्तृत रूपमा राखिएका छन्।

---

## विषयसूची (Table of Contents)
1. [परिचय र मुख्य धारणा (Introduction & Core Concepts)](#१-परिचय-र-मुख्य-धारणा)
2. [इन्स्टलेसन र सेटअप (Installation & Setup)](#२-इन्स्टलेसन-र-सेटअप)
3. [All-in-One `<dolphin-store>` इन्जिन (Universal Store Engine)](#३-all-in-one-dolphin-store-इन्जिन)
4. [डिक्लेरेटिभ फिल्टर, सर्च र सर्टिङ (Declarative Filter, Search & Sort)](#४-डिक्लेरेटिभ-फिल्टर-सर्च-र-सर्टिङ)
5. [रियाक्टिभ एक्सन र रिसेट (Reactive Actions & Auto Reset)](#५-रियाक्टिभ-एक्सन-र-रिसेट)
6. [डिक्लेरेटिभ डोम बाइन्डिङ्स र टेम्पलेटहरू (Declarative Bindings & Templates)](#६-डिक्लेरेटिभ-डोम-बाइन्डिङ्स-र-टेम्पलेटहरू)
7. [API र रियल-टाइम वेबसकेट सिङ्किङ (API & WebSocket Sync)](#७-api-र-रियल-टाइम-वेबसकेट-सिङ्किङ)
8. [भर्चुअल स्क्रोलिङ र १०,००० डेटा ह्यान्डलिङ (Virtual Scrolling)](#८-भर्चुअल-स्क्रोलिङ-र-१०-०००-डेटा-ह्यान्डलिङ)
9. [Next.js सँग १००% SEO म्यानेजमेन्ट (Next.js 100% SEO Integration)](#९-nextjs-सँग-१००-seo-म्यानेजमेन्ट)

---

## १. परिचय र मुख्य धारणा

डल्फिन क्लाइन्ट एउटा **HTML-first रियाक्टिभ इन्जिन** हो। यसको मुख्य उद्देश्य जाभास्क्रिप्ट कोड धेरै नलेखी सीधै HTML एट्रिब्युटहरू (`data-*`) बाटै फ्रन्टइन्डमा स्टेट (State) र युआई (UI) लाई जोड्नु हो।

### मुख्य विशेषताहरू:
* **Zero Virtual DOM Overhead**: भर्चुअल डोमको झन्झट बिना सीधै वास्तविक DOM लाई सटिक रूपमा अपडेट (Real DOM Diffing) गर्छ।
* **Zero JavaScript Boilerplate**: बटन क्लिक, इनपुट चेन्ज, स्टोर रिसेट र सर्भर फेच जस्ता कुराहरू HTML बाटै सिधै व्यवस्थापन हुन्छन्।
* **Universal Store Engine**: JSON Object, Mock Arrays, Key-Value attributes, LocalStorage Persistence र REST API सबै एउटै `<dolphin-store>` tag बाट चल्छन्।
* **Lightweight**: बन्डल साइज केवल ७४KB (Minified) छ।

---

## २. इन्स्टलेसन र सेटअप

तपाईंले डल्फिनलाई दुई तरिकाले प्रयोग गर्न सक्नुहुन्छ:

### तरिका क: सादा HTML को लागि (Direct Link)
आफ्नो `index.html` मा यो स्क्रिप्ट थप्नुहोस्। डल्फिन स्वतः auto-initialize हुन्छ:

```html
<!-- Router configuration लागू गर्ने (Body attributes) -->
<body data-router-mode="hash" data-router-viewport="main" data-router-transitions="true">

<!-- डल्फिन लाइब्रेरी लोड गर्ने (Auto-initialize हुन्छ) -->
<script src="./dolphin-client.js" data-debug="true"></script>
```

---

## ३. All-in-One `<dolphin-store>` इन्जिन

`<dolphin-store>` डल्फिन क्लाइन्टको सबैभन्दा शक्तिशाली तत्व हो। यसले फ्रन्टइन्डका सम्पूर्ण डाटा र स्टेटलाई एउटै कस्टम HTML tag बाट नियन्त्रण गर्छ।

### क. JSON Object Store (App State, Filters, Users)
```html
<dolphin-store name="user">
  {
    "name": "Shankar Phuyal",
    "role": "Admin",
    "isLoggedIn": true
  }
</dolphin-store>
```

### ख. Array of Objects / Mock Data Store (Lists, Tables)
```html
<dolphin-store name="products">
  [
    { "id": 1, "title": "Backpack", "price": 109.95, "category": "men's clothing" },
    { "id": 2, "title": "Jacket", "price": 55.99, "category": "men's clothing" }
  ]
</dolphin-store>
```

### ग. Direct Key-Value Attributes Store (Counters, Toggles)
```html
<dolphin-store name="app" count="0" view="home" isModalOpen="false"></dolphin-store>
```

### घ. Real REST API Endpoint Fetch (`data-api-get`)
```html
<!-- Server API Endpoint बाट स्वतः Data Load गर्छ -->
<dolphin-store name="products" data-api-get="https://fakestoreapi.com/products"></dolphin-store>
```

### ङ. Real-time Live Background Polling (`data-api-poll`)
```html
<!-- हरेक ५ सेकेन्ड (5000ms) मा स्वतः Server बाट नयाँ Data Refresh गर्छ -->
<dolphin-store name="stats" data-api-get="/api/live-stats" data-api-poll="5000"></dolphin-store>
```

### च. LocalStorage Auto-Persistence (`data-persist="true"`)
```html
<!-- Page Reload गर्दा वा Browser बन्द गर्दा पनि Cart/State स्वतः Save रहन्छ -->
<dolphin-store name="cart" data-persist="true"> [] </dolphin-store>
```

---

## ४. डिक्लेरेटिभ फिल्टर, सर्च र सर्टिङ

डल्फिनमा बिना कुनै JavaScript Code सिधै HTML attributes बाटै Data लाई Real-time Filter, Search र Sort गर्न सकिन्छ:

```html
<!-- १. Filter & Search Store तयार गर्ने -->
<dolphin-store name="filter">
  {
    "category": "",
    "query": "",
    "sort": ""
  }
</dolphin-store>

<!-- २. Filter Controls (Search Bar, Category Buttons & Sort Select) -->
<input type="text" data-store-write="filter.query" placeholder="🔍 Search products...">

<button data-store-click="filter.category = ''">All</button>
<button data-store-click="filter.category = 'jewelery'">Jewelry</button>
<button data-store-click="filter.category = 'electronics'">Electronics</button>

<select data-store-write="filter.sort">
  <option value="">Default Order</option>
  <option value="price-low">Price: Low → High</option>
  <option value="price-high">Price: High → Low</option>
  <option value="popular">Popularity (Rating)</option>
</select>

<!-- ३. Filtered & Sorted Product Grid Container -->
<div
  data-rt-bind="store/products"
  data-rt-template="#shop"
  data-rt-filter="category == filter.category"
  data-rt-search="title == filter.query"
  data-rt-sort="filter.sort">
</div>
```

---

## ५. रियाक्टिभ एक्सन र रिसेट

### क. Zero-JS Counter & Actions (`data-store-click`)
```html
<dolphin-store name="app" count="0"></dolphin-store>

<div data-rt-bind="store/app" data-rt-type="context">
  <h2>Count: <span data-rt-text="count">0</span></h2>

  <button data-store-click="count = count + 1">+१ बढाउनुहोस्</button>
  <button data-store-click="count = count - 1">-१ घटाउनुहोस्</button>
</div>
```

### ख. One-Click Store Reset (`data-store-reset`)
कुनै पनि स्टोरलाई १ क्लिकमा शुरुआती अवस्थामा ल्याउन:
```html
<button data-store-reset="app">Reset Count</button>
```

---

## ६. डिक्लेरेटिभ डोम बाइन्डिङ्स र टेम्पलेटहरू

### Svelte-Style Inline Template (`<template id="shop">`)
```html
<template id="shop">
  <div class="card">
    <img src="{{image}}" alt="{{title}}">
    <h3>{{title}}</h3>
    <span>${{price}}</span>
    <span>★ {{rating.rate}}</span>
  </div>
</template>
```

---

## ७. API र रियल-टाइम वेबसकेट सिङ्किङ

### CRUD Operations (Declarative Forms & Buttons)

#### POST (नयाँ डेटा थप्ने):
```html
<form data-api-submit="POST /api/products" data-api-result="store/products">
  <input name="title">
  <input name="price">
  <button type="submit">Add Product</button>
</form>
```

#### DELETE (डाटा हटाउने):
```html
<button 
  data-api-click="DELETE /api/products/{{id}}" 
  data-store-click="products = products.filter(p => p.id !== {{id}})">
  Delete 🗑️
</button>
```

---

## ८. भर्चुअल स्क्रोलिङ र १०,००० डेटा ह्यान्डलिङ

१०,००० भन्दा बढी डाटा भएको अवस्थामा DOM नअल्झियोस् भन्नाका लागि Virtual Scroll Directives:

```html
<div 
  data-rt-bind="store/largeList" 
  data-rt-template="#itemTemplate"
  data-virtual-scroll="true"
  data-item-height="60"
  style="height: 500px; overflow-y: auto;">
</div>
```

---

## ९. Next.js सँग १००% SEO म्यानेजमेन्ट

Next.js (App Router वा Pages Router) सँग डल्फिन क्लाइन्ट प्रयोग गर्दा Server-Side Rendering (SSR) र SEO १००% अछिन्न रहन्छ:

```tsx
'use client';
import { useEffect } from 'react';

export default function ProductsPage() {
  useEffect(() => {
    import('dolphin-client').then(({ DolphinClient }) => {
      const dolphin = new DolphinClient();
      dolphin._scanStoreBinds();
    });
  }, []);

  return (
    <div>
      <dolphin-store name="products" data-api-get="https://fakestoreapi.com/products"></dolphin-store>
      <div data-rt-bind="store/products" data-rt-template="#shop"></div>
    </div>
  );
}
```

---

## निष्कर्ष (Summary)

डल्फिन क्लाइन्टले आधुनिक वेब विकासलाई **सरल, तीव्र र झन्झटमुक्त** बनाएको छ। बिना कुनै `node_modules` वा Heavy Frameworks, केवल सादा HTML5 बाटै जुनसुकै स्तरको वेब एप बनाउन सकिन्छ! 🚀
