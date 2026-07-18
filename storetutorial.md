# Dolphin Client State Management Tutorial 🐬 (० देखि सिक्नुहोस्!)

यो ट्युटोरियलमा हामी डल्फिन क्लाइन्टको **State Management (UI Stores)** कसरी काम गर्छ भन्ने कुरा एकदम सुरु (Zero) देखि सिक्नेछौँ।

---

## १. Core Concept (मुख्य धारणा)

डल्फिनमा ३ प्रकारका स्टोरहरू हुन्छन्:

| स्टोर प्रकार (Store Type) | के काम गर्छ? (What it does) | उदाहरण (Example) |
| :--- | :--- | :--- |
| **१. Global Store (ग्लोबल स्टोर)** | सबै pages मा accessible हुने shared state। `store.html` मा define गरिन्छ। | `store/global` (जस्तै: user profile, settings) |
| **२. UI Store (स्थानीय स्टोर)** | ब्राउजरको लोकल स्टेट (Local State) व्यवस्थापन गर्छ। जस्तै: बटन थिच्दा Modal खोल्ने, Form देखाउने/लुकाउने, काउन्टर बढाउने आदि। | `store/app` (जस्तै: `isAdding`, `editId`) |
| **३. Database Store (डेटाबेस स्टोर)** | ब्याकइन्ड सर्भर वा डेटाबेसको डेटालाई रियल-टाइममा सिंक (Sync) गर्छ। | `store/products` (जस्तै: उत्पादनहरूको सूची) |

> [!IMPORTANT]
> **डल्फिनको सिद्धान्त**: HTML भित्रै एट्रिब्युटहरू (`data-*`) लेखेर बिना कुनै अतिरिक्त जाभास्क्रिप्ट कोड स्टेट म्यानेजमेन्ट गर्नु हो।

---

## २. Global Store: store.html बाट सबै Pages मा Data Share गर्ने

Global Store ले तपाईंलाई एउटा केन्द्रीय फाइल (`store.html`) मा store define गरेर सबै pages मा त्यो data access गर्न दिन्छ। यो user profile, settings, वा कुनै पनि shared data को लागि उपयुक्त छ।

### Step 1: store.html बनाउने

पहिले एउटा `store.html` फाइल बनाउनुहोस् र global store define गर्नुहोस्:

```html
<!-- store.html -->
<dolphin-store name="global" data-api-get="https://jsonplaceholder.typicode.com/users/1">
  <!-- Hidden container for reactivity -->
</dolphin-store>
```

**Key Points:**
- `name="global"` - Store को नाम
- `data-api-get="..."` - API बाट data automatically fetch गर्ने (optional)
- Child element राख्नुपर्छ reactivity को लागि

### Step 2: index.html मा store.html import गर्ने

```html
<!-- index.html -->
<body data-router-mode="hash" data-router-viewport="main" data-router-transitions="true">
   <!-- Global Store - सबै pages मा accessible -->
   <div data-import="./store.html"></div>

   <div data-import="./components/header.html"></div>
   <main id="viewport">
     <div data-import="./pages/home.html"></div>
   </main>
   <div data-import="./components/footer.html"></div>
</body>
```

### Step 3: कुनै पनि Page मा Global Store Use गर्ने

```html
<!-- pages/about.html -->
<div data-rt-bind="store/global" data-rt-type="context">
  <div class="card">
    <h3 data-rt-text="name"></h3>
    <p>Username: <span data-rt-text="username"></span></p>
    <p>Email: <span data-rt-text="email"></span></p>
  </div>
</div>
```

**Key Directives:**
- `data-rt-bind="store/global"` - Global store सँग bind गर्ने
- `data-rt-type="context"` - Context mode enable गर्ने
- `data-rt-text="fieldName"` - Store field बाट text display गर्ने

### Global Store को फाइदाहरू (Advantages):
- **Single Source of Truth**: सबै pages मा same data accessible
- **Page Navigation मा Persist**: Page navigate गर्दा store data बनेकै रहन्छ
- **API Integration**: `data-api-get` ले automatically data fetch गर्छ
- **No JavaScript Required**: Pure HTML attributes मात्र

### Global Store मा Static Data Seed गर्ने (API बिना):

```html
<!-- store.html -->
<dolphin-store name="global">
  {
    "username": "Shankar",
    "role": "Admin",
    "email": "shankar@example.com"
  }
</dolphin-store>
```

### Global Store मा Manual Data Update गर्ने:

```html
<!-- कुनै page मा -->
<button data-store-click="global.username = 'NewUser'">Update Username</button>
```

---

## ३. UI Store: Step-by-Step counter Example (० बाट काउन्टर बनाउने)

काउन्टर बनाउन हामीलाई एउटा नम्बर स्टोर गर्ने स्टेट र त्यसलाई बढाउने/घटाउने बटन चाहिन्छ।

### HTML Code:
```html
<!-- १. हामी हाम्रो सेक्सनलाई 'store/app' स्टोरसँग बाइन्ड गर्छौँ -->
<div data-rt-bind="store/app" data-rt-type="context">

  <!-- २. स्टोरको भ्यालु पढ्ने (Read) र देखाउने -->
  <h3>काउन्टर भ्यालु: <span data-store-read="app.count">0</span></h3>

  <!-- ३. बटन क्लिक गर्दा स्टोरको भ्यालु बढाउने र घटाउने (Write/Action) -->
  <button data-store-click="app.count = (app.count || 0) + 1">+ १ बढाउनुहोस्</button>
  <button data-store-click="app.count = (app.count || 0) - 1">- १ घटाउनुहोस्</button>
  <button data-store-click="app.count = 0">रिसेट</button>

</div>
```

### यसले कसरी काम गर्छ? (How it works under the hood)
* `data-rt-bind="store/app"`: यसले यो डिभ भित्रका सबै कुरालाई `app` नामक स्टोरको अपडेट सुन्न तयार पार्छ।
* `data-store-read="app.count"`: डल्फिनले `app` स्टोरको `count` भ्यालु परिवर्तन हुने बित्तिकै यो स्प्यान भित्रको टेक्स्टलाई स्वतः अपडेट गर्छ।
* `data-store-click="app.count = ..."`: बटन थिच्दा सिधै स्टोरमा गणितीय हिसाब हुन्छ। डल्फिनले जाभास्क्रिप्ट बिनै यसलाई मूल्याङ्कन (evaluate) गरेर स्टोर अपडेट गर्छ र अपडेट हुने बित्तिकै `data-store-read` भएको ठाउँमा भ्यालु परिवर्तन हुन्छ।

---

## ४. Dynamic Modal / Toggle Example (मोडल खोल्ने र बन्द गर्ने)

पेजमा कुनै कुरालाई देखाउन वा लुकाउन कन्डिसनल स्टेट (`true` वा `false`) चाहिन्छ।

### HTML Code:
```html
<div data-rt-bind="store/app" data-rt-type="context">

  <!-- १. मोडल खोल्ने बटन -->
  <button data-store-click="app.isModalOpen = true">मोडल खोल्नुहोस्</button>

  <!-- २. मोडल कार्ड: app.isModalOpen = true हुँदा मात्र देखिन्छ -->
  <div data-rt-if="isModalOpen" style="background: rgba(0,0,0,0.8); padding: 20px; border-radius: 8px;">
    <h2>यसलाई मोडल भनिन्छ! 🐬</h2>
    <p>के तपाईंलाई डल्फिन मन पर्यो?</p>
    
    <!-- ३. मोडल बन्द गर्ने बटन -->
    <button data-store-click="app.isModalOpen = false">बन्द गर्नुहोस् (Close)</button>
  </div>

</div>
```

### मुख्य डाइरेक्टिभ्स (Key Directives):
* **`data-rt-if="expression"`**: यदि यस भित्रको कन्डिसन `true` भयो भने मात्र यो एलिमेन्ट स्क्रिनमा देखिन्छ, `false` भयो भने `display: none` हुन्छ।
* **`data-store-click="app.isModalOpen = !app.isModalOpen"`**: यसले भ्यालुलाई टगल (Toggle - अन/अफ) गर्छ।

---

## ५. Unified Add/Update Form (एकै फर्मबाट थप्ने र सम्पादन गर्ने)

तपाईंले भर्खरै `home.html` मा प्रयोग गर्नुभएको एउटै फर्मले कसरी दुवै थप्ने (Add) र अपडेट गर्ने (Update) काम गर्छ, त्यसको रहस्य यहाँ छ:

### HTML Code:
```html
<!-- १. पूरै फर्म र बटनलाई 'store/app' स्टोरसँग बाइन्ड गर्छौँ -->
<div data-rt-bind="store/app" data-rt-type="context">

  <!-- २. यदि थप्ने वा सम्पादन गर्ने मध्ये कुनै एउटा एक्टिभ छ भने मात्र फर्म देखाउने -->
  <div data-rt-if="isAdding || isEditing" class="card">
    
    <!-- ३. यदि editId छ भने 'Edit Product' नत्र 'Add New Product' शीर्षक देखाउने -->
    <h3 data-rt-text="editId ? 'Edit Product' : 'Add New Product'"></h3>

    <!-- ४. editId को आधारमा API URL र सफलताको म्यासेज डाइनामिक रूपमा परिवर्तन गर्ने -->
    <form data-rt-attr="
      data-api-submit: editId ? 'PUT /api/products/' + editId : 'POST /api/products',
      data-api-toast: editId ? 'Product updated successfully!' : 'Product added successfully!'
    " data-api-reload>

      <!-- ५. स्टोरसँग टु-वे बाइन्डिङ (Two-way binding) भएका इनपुट फिल्डहरू -->
      <input type="text" name="title" data-store-read="app.editTitle" data-store-write="app.editTitle" placeholder="Title" />
      <input type="number" name="price" data-store-read="app.editPrice" data-store-write="app.editPrice" placeholder="Price" />

      <!-- ६. डाइनामिक सबमिट बटनको टेक्स्ट -->
      <button type="submit" data-rt-text="editId ? 'Save Changes' : 'Save Product'"></button>
      
      <!-- ७. क्यान्सिल बटन: यसले सबै स्टोर भ्यालुहरू खाली गर्छ -->
      <button type="button" data-store-click="app.isEditing = false; app.isAdding = false; app.editId = null; app.editTitle = ''; app.editPrice = '';">Cancel</button>
    </form>
  </div>

  <!-- ८. टेबल र सम्पादन बटन (रो भित्रको डेटा स्टोरमा सार्ने) -->
  <table>
    <!-- रो टेम्पलेट -->
    <tr data-rt-type="context">
      <td>{{title}}</td>
      <td>
        <!-- सम्पादन बटन थिच्दा यो रोको डेटा (id, title, price) लाई ग्लोबल 'app' स्टोरमा पठाइन्छ -->
        <button data-store-click="
          app.editId = id; 
          app.editTitle = title; 
          app.editPrice = price; 
          app.isEditing = true; 
          app.isAdding = false;
        ">Edit</button>
      </td>
    </tr>
  </table>

</div>
```

### यो कसरी चल्छ? (Detailed Workflow):

1. **Add Product बटन थिच्दा**:
   * हामी स्टोरका भ्यालुहरू खाली गर्छौँ: `app.editId = null; app.editTitle = ''; app.editPrice = ''; app.isAdding = true;`
   * `editId` खाली (`null`) भएकोले:
     * शीर्षक स्वतः **"Add New Product"** बन्छ।
     * फर्मको `data-api-submit` स्वतः **`POST /api/products`** बन्छ।
     * सबमिट बटनको टेक्स्ट स्वतः **"Save Product"** बन्छ।

2. **टेबलको Edit बटन थिच्दा**:
   * टेबलको रो (Row) सँग आफ्नै लोकल डेटा हुन्छ (जस्तै: `id: 42`, `title: "T-Shirt"`, `price: 15`)।
   * Edit बटन थिच्दा यो डेटा ग्लोबल स्टोरमा कपी हुन्छ: `app.editId = 42; app.editTitle = 'T-Shirt'; app.editPrice = 15; app.isEditing = true;`
   * `editId` को भ्यालु `42` (सत्य/truthy) भएकोले:
     * शीर्षक स्वतः **"Edit Product"** बन्छ।
     * इनपुट फिल्डहरूमा स्टोरबाट भ्यालुहरू (`T-Shirt`, `15`) स्वतः भरिन्छन्।
     * फर्मको `data-api-submit` स्वतः **`PUT /api/products/42`** बन्छ।
     * सबमिट बटनको टेक्स्ट स्वतः **"Save Changes"** बन्छ।

यो तरिकाले एउटै फर्मले परिस्थिति अनुसार आफ्नै रूप परिवर्तन गर्दछ र हामीले एउटै पनि अतिरिक्त जाभास्क्रिप्ट फङ्ग्सन लेख्नु पर्दैन!

---

## ६. Debugging UI Stores: `log()` Helper (डेटा सजिलै कन्सोलमा हेर्ने)

डल्फिन क्लाइन्टमा कुनै पनि स्टोर वा लोकल चलराशि (Variable) को डेटा ब्राउजर कन्सोलमा सफासँग हेर्नको लागि एउटा बिल्ट-इन **`log()`** फङ्ग्सन उपलब्ध गराइएको छ। 

यसको लागि तपाईंले `data-store-[click|change]` भित्र सिधै `log(storeName)` वा `log(variable)` लेख्न सक्नुहुन्छ:

### कन्सोलमा स्टोरको डेटा सादा रूपमा प्रिन्ट गर्न:
```html
<!-- register स्टोरका सबै डाटाहरू कन्सोलमा अब्जेक्टको रूपमा प्रिन्ट गर्न -->
<button data-store-click="log(register)">Log Register Store</button>

<!-- app स्टोरका सबै डाटाहरू कन्सोलमा अब्जेक्टको रूपमा प्रिन्ट गर्न -->
<button data-store-click="log(app)">Log App Store</button>
```

### कन्सोलमा साधारण म्यासेज वा चलराशिको मान प्रिन्ट गर्न:
```html
<button data-store-click="log('Hello Dolphin!')">Log Text</button>
<button data-store-click="log(app.editTitle)">Log Variable Value</button>
```

**यसले कसरी काम गर्छ?**:
डल्फिनले `log()` को प्यारामिटरमा कुनै स्टोर (जस्तै `register`) पठाइएको छ भने, त्यसको वास्तविक डाटाहरूलाई कन्सोलमा `%c📊 [Dolphin Store: register]:` शीर्षक राखेर सफा अब्जेक्टको रूपमा देखाइदिन्छ। यसले तपाईंलाई कन्सोल खोल्ने बित्तिकै कुन स्टोरमा के डेटा छ भनी हेर्न एकदमै सजिलो बनाउँछ!
