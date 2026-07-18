# डल्फिन क्लाइन्ट विकासकर्ता ट्युटोरियल (Dolphin Client Full Developer Tutorial) 🐬

डल्फिन क्लाइन्ट (`dolphin-client`) मा यहाँलाई स्वागत छ! यो ट्युटोरियलमा हामी डल्फिन क्लाइन्टको प्रयोग गरेर बिना कुनै जटिल फ्रेमवर्क (जस्तै React, Vue वा Angular) सादा HTML, CSS र JS बाटै सुपर-फास्ट, रियाक्टिभ र रियल-टाइम वेब एपहरू कसरी बनाउने भन्ने कुरा **सुरु देखि अन्तिम सम्म नेपालीमा सिक्नेछौँ**।

यो दस्तावेजमा प्रत्येक फिचर, डेटा बाइन्डिङ, स्टोर म्यानेजमेन्ट, र हालै थपिएको **भर्चुअल स्क्रोलिङ** सहित सबै कोडहरू विस्तृत रूपमा राखिएका छन्।

---

## विषयसूची (Table of Contents)
1. [परिचय र मुख्य धारणा (Introduction & Core Concepts)](#१-परिचय-र-मुख्य-धारणा)
2. [इन्स्टलेसन र सेटअप (Installation & Setup)](#२-इन्स्टलेसन-र-सेटअप)
3. [स्टेट म्यानेजमेन्ट र स्टोरहरू (State Management & Stores)](#३-स्टेट-म्यानेजमेन्ट-र-स्टोरहरू)
4. [डिक्लेरेटिभ डोम बाइन्डिङ्स (Declarative DOM Bindings)](#४-डिक्लेरेटिभ-डोम-बाइन्डिङ्स)
5. [टेम्पलेट कम्पाइलर र लुपहरू (Templates & Loops)](#५-टेम्पलेट-कम्पाइलर-र-लुपहरू)
6. [प्रयोगकर्ता अन्तरक्रिया (User Interactions & Input Writing)](#६-प्रयोगकर्ता-अन्तरक्रिया-र-इनपुट-राइटिङ)
7. [भर्चुअल स्क्रोलिङ र १०,००० डेटा ह्यान्डलिङ (Virtual Scrolling - 10,000+ Items)](#७-भर्चुअल-स्क्रोलिङ-र-१००००-डेटा-ह्यान्डलिङ)
8. [API र रियल-टाइम वेबसकेट सिङ्किङ (API & WebSocket Sync)](#८-api-र-रियल-टाइम-वेबसकेट-सिङ्किङ)
9. [Next.js सँग १००% SEO म्यानेजमेन्ट (Next.js 100% SEO Integration)](#९-nextjs-सँग-१००-seo-म्यानेजमेन्ट)

---

## १. परिचय र मुख्य धारणा

डल्फिन क्लाइन्ट एउटा **HTML-first रियाक्टिभ इन्जिन** हो। यसको मुख्य उद्देश्य जाभास्क्रिप्ट कोड धेरै नलेखी सीधै HTML एट्रिब्युटहरू (`data-*`) बाटै फ्रन्टइन्डमा स्टेट (State) र युआई (UI) लाई जोड्नु हो।

### मुख्य विशेषताहरू:
* **No Virtual DOM Overhead**: यसले भर्चुअल डोमको झन्झट बिना सीधै वास्तविक DOM लाई सटिक रूपमा अपडेट (DOM Diffing) गर्छ।
* **Zero JavaScript Boilerplate**: बटन क्लिक, इनपुट चेन्ज र सर्भर फेच जस्ता कुराहरू HTML बाटै सिधै व्यवस्थापन हुन्छन्।
* **Lightweight**: यसको बन्डल साइज केवल ७४KB (Minified) छ।

---

## २. इन्स्टलेसन र सेटअप

तपाईंले डल्फिनलाई दुई तरिकाले प्रयोग गर्न सक्नुहुन्छ:

### तरिका क: सादा HTML को लागि (Direct Link)
आफ्नो `index.html` मा यो स्क्रिप्ट थप्नुहोस्। डल्फिनले स्वतः auto-initialize हुन्छ:

```html
<!-- Router configuration लागू गर्ने (Body attributes) -->
<body data-router-mode="hash" data-router-viewport="main" data-router-transitions="true">

<!-- डल्फिन लाइब्रेरी लोड गर्ने (Auto-initialize हुन्छ) -->
<script src="./dolphin-client.js"></script>
```

**Body Attributes Options:**
- `data-router-mode="hash"` - Hash routing (#/about.html) वा `"history"` (clean URLs)
- `data-router-viewport="main"` - Router ले कुन element मा content swap गर्ने
- `data-router-transitions="true"` - Fade transitions enable गर्ने

### तरिका ख: NPM मार्फत (React/Vite/Next.js को लागि)
```bash
npm install dolphin-client
```
जाभास्क्रिप्टमा इम्पोर्ट गर्ने तरिका:
```javascript
import { DolphinClient } from 'dolphin-client';

const dolphin = new DolphinClient();
dolphin.connect();
```

---

## ३. स्टेट म्यानेजमेन्ट र स्टोरहरू

डल्फिनमा स्टेट व्यवस्थापन गर्न **`<dolphin-store>`** ट्यागको प्रयोग गरिन्छ। यसले स्टोरमा भएका डेटा परिवर्तन हुने बित्तिकै सम्बन्धित युआईलाई स्वतः रि-रेन्डर गराउँछ।

### स्टोर सिर्जना गर्ने र डेटा सिड (Seed) गर्ने:
तपाईंले HTML भन्तर यसरी स्टोर डिफाइन गर्न सक्नुहुन्छ:

```html
<!-- 'app' नामको स्टोरमा default भ्यालुहरू राखेको -->
<dolphin-store name="app" count="0" view="home"></dolphin-store>

<!-- JSON डेटा सिड गर्नका लागि (जस्तै उत्पादनहरूको सूची) -->
<dolphin-store name="products">
  {
    "filtercategory": "",
    "searchquery": "",
    "sortby": "",
    "items": [
      { "id": 1, "title": "Fjallraven Backpack", "price": 109.95, "category": "men's clothing", "image": "https://picsum.photos/200" },
      { "id": 2, "title": "Mens Casual Slim Fit", "price": 22.99, "category": "men's clothing", "image": "https://picsum.photos/200" }
    ]
  }
</dolphin-store>
```

जाभास्क्रिप्टबाट स्टोरको डेटा पढ्न वा लेख्न:
```javascript
// डेटा पढ्न (Get State)
const currentCount = window.dolphin.getStoreState('app', 'count'); // returns 0

// डेटा लेख्न/अपडेट गर्न (Set State)
window.dolphin.setStoreState('app', 'count', 5); // count updates to 5 and updates DOM instantly
```

---

## ४. डिक्लेरेटिभ डोम बाइन्डिङ्स

डल्फिनले कुनै पनि स्टोरको अपडेट सुन्नका लागि **`data-rt-bind="store/storeName"`** एट्रिब्युट प्रयोग गर्छ। यस भित्रका एलिमेन्टहरूमा हामी निम्न डाइरेक्टिभहरू लेख्न सक्छौँ:

### क. `data-rt-text` (टेक्स्ट देखाउन)
स्टोरको डेटालाई सीधै टेक्स्टको रूपमा प्रिन्ट गर्छ।
```html
<div data-rt-bind="store/app" data-rt-type="context">
  <!-- app.count परिवर्तन हुँदा यो स्वतः चेन्ज हुन्छ -->
  <p>काउन्टर: <span data-rt-text="count">0</span></p>
</div>
```

### ख. `data-rt-html` (HTML रेन्डर गर्न)
यदि डेटामा HTML ट्यागहरू छन् भने सुरक्षित रूपमा रेन्डर गर्छ।
```html
<div data-rt-bind="store/app" data-rt-type="context">
  <div data-rt-html="richDescription"></div>
</div>
```

### ग. `data-rt-attr` (डाइनामिक एट्रिब्युटहरू)
इमेजको `src`, `href` वा इनपुटको `disabled` एट्रिब्युट डाइनामिक बनाउन:
```html
<div data-rt-bind="store/app" data-rt-type="context">
  <!-- imageURL अनुसार src सेट हुन्छ र isValid false हुँदा बटन disabled हुन्छ -->
  <img data-rt-attr="src: imageURL, alt: title" />
  <button data-rt-attr="disabled: !isValid">पठाउनुहोस्</button>
</div>
```

### घ. `data-rt-class` (डाइनामिक क्लास टगल)
कुनै कन्डिसन सत्य हुँदा क्लास थप्न वा हटाउन:
```html
<div data-rt-bind="store/app" data-rt-type="context">
  <!-- isDark true हुँदा 'bg-black text-white' क्लास लाग्छ, नत्र हट्छ -->
  <div data-rt-class="bg-black text-white: isDark">सामग्री</div>
</div>
```

### ङ. `data-rt-if` र `data-rt-hide` (कन्डिसनल रेन्डरिङ)
```html
<div data-rt-bind="store/app" data-rt-type="context">
  <!-- count > 5 हुँदा मात्र यो डिभ देखिन्छ (display: block/none टगल) -->
  <div data-rt-if="count > 5">तपाईंले जित्नुभयो!</div>
  
  <!-- count <= 5 हुँदा यो लुक्छ -->
  <div data-rt-hide="count <= 5">लोड हुँदैछ...</div>
</div>
```

---

## ५. टेम्पलेट कम्पाइलर र लुपहरू

डल्फिनमा सूचिहरू (Arrays) रेन्डर गर्न Svelte-style टेम्पलेट कम्पाइलर प्रयोग गरिन्छ। यसका लागि हामीले `<template>` ट्याग भित्र संरचना तयार गर्नुपर्छ।

### लुप (`{#each ... as ...}`) र कन्डिसनल (`{#if ...}`) को पूर्ण उदाहरण:

```html
<div data-rt-bind="store/products">
  <!-- यो ग्रिड भित्र टेम्पलेट रेन्डर हुन्छ -->
</div>

<!-- टेम्पलेट डिफाइन गर्ने -->
<template id="products-template">
  <!-- {#each} लुप मार्फत items एरे घुमाउने -->
  {#each items as item}
    <div class="card">
      <img src="{{item.image}}" alt="{{item.title}}" />
      <h3>{{item.title}}</h3>
      
      <!-- कन्डिसन अनुसार फरक ब्याज देखाउने -->
      {#if item.price > 100}
        <span class="badge-premium">Premium</span>
      {:else if item.price > 50}
        <span class="badge-mid">Medium</span>
      {:else}
        <span class="badge-budget">Budget</span>
      {/if}

      <p>मूल्य: ${{item.price}}</p>
    </div>
  {/each}
</template>
```

*नोट: `{{item.title}}` मा डबल कर्ली ब्रासेस भित्र अब्जेक्टको प्रोपर्टी पठाइन्छ।*

---

## ६. प्रयोगकर्ता अन्तरक्रिया र इनपुट राइटिङ

प्रयोगकर्ताको क्लिक वा टाइप इभेन्टलाई सिधै स्टोरमा राइट (Write) गर्नका लागि जाभास्क्रिप्ट लेखिरहनु पर्दैन।

### क. `data-store-click` (क्लिक इभेन्ट)
बटन थिच्दा सिधै स्टोरको भ्यालु बढाउन वा टगल गर्न:
```html
<div data-rt-bind="store/app" data-rt-type="context">
  <button data-store-click="app.count = (app.count || 0) + 1">+ १ बढाउनुहोस्</button>
  <button data-store-click="app.isDark = !app.isDark">डार्क मोड टगल</button>
</div>
```

### ख. `data-store-change` र `data-store-input` (इनपुट र सेलेक्ट)
प्रयोगकर्ताले टाइप गर्दा वा विकल्प छान्दा स्वतः स्टोर अपडेट गर्न `this.value` को प्रयोग गरिन्छ:
```html
<div data-rt-bind="store/products" data-rt-type="context">
  
  <!-- टाइप गर्दा searchquery स्टोरमा बस्छ -->
  <input 
    type="text" 
    data-store-input="products.searchquery = this.value" 
    placeholder="सामान खोज्नुहोस्..." 
  />

  <!-- क्याटगोरी छान्दा filtercategory स्टोरमा बस्छ -->
  <select data-store-change="products.filtercategory = this.value">
    <option value="">सबै क्याटगोरी</option>
    <option value="electronics">Electronics</option>
    <option value="jewelery">Jewelery</option>
  </select>

</div>
```

---

## ७. भर्चुअल स्क्रोलिङ र १०,००० डेटा ह्यान्डलिङ

जब हामीसँग १०,००० भन्दा बढी प्रडक्टहरू वा लामो लिस्ट हुन्छ, ब्राउजर ढिलो (lag) नहोस् भन्नका लागि **भर्चुअल स्क्रोलिङ** प्रयोग गरिन्छ। डल्फिनले इन-मेमोरी फिल्टर/सर्ट गरिसकेपछि मात्र स्क्रिनमा देखिने आवश्यक कार्डहरू मात्र रेन्डर गर्छ।

### कसरी लागू गर्ने:
तपाईंले केवल आफ्नो कन्टेनरमा `data-rt-virtual="true"`, `data-rt-item-height="[px]"` र `data-rt-buffer="[count]"` थपिदिए पुग्छ:

```html
<!-- १०,००० डेटा भए पनि सुपर-फास्ट र ल्याग-फ्री चल्छ -->
<div 
  data-rt-bind="store/products" 
  data-rt-virtual="true" 
  data-rt-item-height="200" 
  data-rt-buffer="5"
  style="height: 600px; overflow-y: auto;"
>
  <!-- यहाँ टेम्पलेट स्वतः रेन्डर हुनेछ -->
</div>
```

### भर्चुअल रेन्डरिंगले कसरी काम गर्छ?
1. **In-Memory Sort & Filter**: प्रयोगकर्ताले सर्च वा फिल्टर गर्दा, डल्फिनले पूरा १०,००० एरेलाई पहिले मेमोरीमा सेकेन्डको हजारौँ भाग (milliseconds) मा फिल्टर गर्छ।
2. **Viewport Slicing**: प्रयोगकर्ताको स्क्रोलिङ पोजिसन (`scrollTop`) र कन्टेनरको उचाइ हेरेर हाल स्क्रिनमा देखिने आइटमहरू मात्र (जस्तै ३० वटा) काटिन्छन् (`slice`) र DOM मा रेन्डर हुन्छन्।
3. **Dynamic Spacers**: बाँकी रहेका नदेखिएका हजारौँ आइटमहरूको स्थान ओगट्नका लागि माथि र तल स्वतः पिक्सल्स हाइट सेट गरिएका स्पेसर डिभहरू थपिन्छन्।

---

## ८. API र रियल-टाइम वेबसकेट सिङ्किङ

डल्फिन क्लाइन्टमा ब्याकइन्ड एपीआईबाट स्वतः डेटा तान्ने र पठाउने सुविधाहरू छन्।

### क. स्वतः डेटा तान्ने (`data-api-get`):
जब डल्फिन लोड हुन्छ, यसले सीधै यो एपीआईबाट डेटा तानेर `items` स्टोरमा राख्छ:
```html
<div data-rt-bind="store/products" data-api-get="https://fakestoreapi.com/products">
  <!-- डेटा आएपछि स्वतः रेन्डर हुन्छ -->
</div>
```

### ख. फर्म बुझाउने (`data-api-submit`):
बिना कुनै `fetch` कोड फर्म बुझाउन र डेटा रिलोड गर्न:
```html
<div data-rt-bind="store/app" data-rt-type="context">
  <form 
    data-rt-attr="data-api-submit: 'POST /api/products'" 
    data-api-reload
    data-api-toast="नयाँ सामान सफलतापूर्वक थपियो!"
  >
    <input type="text" name="title" placeholder="शीर्षक" required />
    <input type="number" name="price" placeholder="मूल्य" required />
    <button type="submit">थप्नुहोस्</button>
  </form>
</div>
```

### ग. रियल-टाइम वेबसकेट (WebSockets):
जब क्लाइन्ट `dolphin.connect()` मार्फत ब्याकइन्ड सर्भरसँग जोडिन्छ:
* कुनै पनि युजरले स्टोर अपडेट गर्दा सर्भरले वेबसकेट मार्फत अरू सबै जोडिएका युजरहरूको युआई स्वतः सिङ्क गराइदिन्छ।

---

## ९. Next.js सँग १००% SEO म्यानेजमेन्ट

Next.js (App Router) मा यदि हामीले फ्रन्टइन्डमा मात्र काम गर्ने रियाक्टिभ लाइब्रेरी चलाउनु पर्‍यो भने `"use client"` राख्दा सुरुको SEO स्कोर घट्न सक्छ। यसलाई रोक्न हामी **SSR + Client Hydration** ढाँचा प्रयोग गर्छौँ:

### फाइल संरचना (`page.js` - Server Component):
यो कोडमा कुनै पनि `"use client"` छैन। यसले ब्याकइन्ड सर्भरमै प्रडक्टहरू फेच गरेर सुरुको एचटीएमएल गुगल बटका लागि १००% रेन्डर गर्छ:

```javascript
import Script from 'next/script';

export default async function ProductPage() {
  // १. सर्भरमै डेटा तान्ने (100% SEO Friendly)
  const res = await fetch('https://fakestoreapi.com/products');
  const products = await res.json();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">100% SEO Shop</h1>

      {/* २. ब्याकइन्डबाट आएको डेटालाई डल्फिन स्टोरमा सिड गर्ने */}
      <dolphin-store name="products">
        {JSON.stringify({ 
          items: products, 
          filtercategory: "", 
          searchquery: "", 
          sortby: "" 
        })}
      </dolphin-store>

      {/* ३. सर्भरबाटै रेन्डर भएको एचटीएमएल (Google ले तत्कालै पढ्छ) */}
      <div 
        data-rt-bind="store/products" 
        data-rt-virtual="true" 
        data-rt-item-height="250"
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        {products.map(item => (
          <div key={item.id} className="product-card border p-4 rounded shadow-sm">
            <img src={item.image} alt={item.title} className="h-40 mx-auto object-contain" />
            <h3 className="font-bold text-sm mt-2">{item.title}</h3>
            <p className="text-cyan-600 font-extrabold">${item.price}</p>
          </div>
        ))}
      </div>

      {/* ४. क्लाइन्टमा सर्ट वा फिल्टर हुँदा डल्फिनले चलाउने टेम्पलेट */}
      <template id="product-card-template">
        <div className="product-card border p-4 rounded shadow-sm">
          <img src="{{image}}" alt="{{title}}" className="h-40 mx-auto object-contain" />
          <h3 className="font-bold text-sm mt-2">{{title}}</h3>
          <p className="text-cyan-600 font-extrabold">${{price}}</p>
        </div>
      </template>

      {/* ५. ब्राउजरमा मात्र डल्फिन इन्जिन लोड र हाइड्रेट गराउने */}
      <Script src="/dolphin-client.js" strategy="afterInteractive" />
      <Script id="init-dolphin" strategy="afterInteractive">
        {`
          document.addEventListener('DOMContentLoaded', () => {
            window.dolphin = new DolphinModule.DolphinClient();
          });
        `}
      </Script>
    </div>
  );
}
```

यसले गर्दा तपाईंको Next.js एप **१००% SEO फ्रेन्डली** हुन्छ र ब्राउजरमा पुगेपछि डल्फिनले युआईलाई **सुपर-फास्ट, नो-ल्याग रियाक्टिभ एप** मा परिणत गर्छ!

---

बधाई छ! तपाईंले डल्फिन क्लाइन्टको पूर्ण ज्ञान नेपालीमा हासिल गर्नुभएको छ। अब तपाईं ढुक्कसँग आफ्नो नेक्स्ट जेएस वा जुनसुकै वेब प्रोजेक्टहरू डल्फिनको मद्दतले डेभलप गर्न सक्नुहुन्छ! 🐬
