# 🐬 Dolphin-Client मा Icon प्रयोग गर्ने पूर्ण गाइड

## परिचय
Dolphin-client मा **Lucide Icons** को built-in support छ। यसले 1000+ professional SVG icons प्रदान गर्छ जुन automatic रूपमा CDN बाट load हुन्छन् र localStorage मा cache हुन्छन्।

---

## Icon कसरी प्रयोग गर्ने

### ✅ Version 1.2.4 को लागि (तपाईंको current version)

तपाईंले **dolphin-icon-spacer** class भएको `<span>` tag प्रयोग गर्नुपर्छ:

```html
<span class="dolphin-icon-spacer w-6 h-6 text-blue-600" data-icon-name="shopping-cart"></span>
```

### मुख्य कुराहरू:
- **Class**: `dolphin-icon-spacer` (अनिवार्य)
- **Attribute**: `data-icon-name="icon-name"` (kebab-case मा)
- **Styling**: Tailwind वा custom CSS classes थप्न सकिन्छ

---

## HTML मा Direct Icon

```html
<div class="flex items-center gap-2">
  <span class="dolphin-icon-spacer w-8 h-8 text-red-500" data-icon-name="heart"></span>
  <span>Favourite</span>
</div>
```

---

## Template भित्र Icon

```html
<template id="product-card">
  <div class="card">
    <!-- Icon with dynamic color from data -->
    <span class="dolphin-icon-spacer w-6 h-6 text-blue-600" data-icon-name="package"></span>
    <h3>{{title}}</h3>
    
    <div class="price">
      <span class="dolphin-icon-spacer w-4 h-4 text-green-600" data-icon-name="dollar-sign"></span>
      <span>${{price}}</span>
    </div>
    
    <!-- Button भित्र icon -->
    <button>
      <span class="dolphin-icon-spacer w-5 h-5" data-icon-name="shopping-cart"></span>
      थप्नुहोस्
    </button>
  </div>
</template>
```

---

## Conditional Icons (सर्त अनुसार)

```html
<template id="status-template">
  {#if status === 'available'}
    <span class="dolphin-icon-spacer w-6 h-6 text-green-500" data-icon-name="check-circle"></span>
  {:else if status === 'pending'}
    <span class="dolphin-icon-spacer w-6 h-6 text-yellow-500" data-icon-name="clock"></span>
  {:else}
    <span class="dolphin-icon-spacer w-6 h-6 text-red-500" data-icon-name="x-circle"></span>
  {/if}
</template>
```

---

## Loop भित्र Icons

```html
<template id="notification-list">
  {#each notifications as notif}
    <div class="notification">
      <!-- प्रत्येक notification को type अनुसार icon -->
      {#if notif.type === 'message'}
        <span class="dolphin-icon-spacer w-5 h-5 text-blue-500" data-icon-name="mail"></span>
      {:else if notif.type === 'alert'}
        <span class="dolphin-icon-spacer w-5 h-5 text-red-500" data-icon-name="alert-triangle"></span>
      {:else}
        <span class="dolphin-icon-spacer w-5 h-5 text-gray-500" data-icon-name="bell"></span>
      {/if}
      <span>{{notif.message}}</span>
    </div>
  {/each}
</template>
```

---

## Interactive Buttons with Icons

```html
<template id="action-buttons">
  <div class="button-group">
    <!-- Delete button -->
    <button data-api-click="DELETE /api/items/{{id}}" 
            class="btn-danger">
      <span class="dolphin-icon-spacer w-4 h-4" data-icon-name="trash"></span>
      Delete
    </button>
    
    <!-- Edit button -->
    <button data-store-click="app.editing = true" 
            class="btn-primary">
      <span class="dolphin-icon-spacer w-4 h-4" data-icon-name="edit"></span>
      Edit
    </button>
    
    <!-- Save button -->
    <button data-api-click="PUT /api/items/{{id}}" 
            class="btn-success">
      <span class="dolphin-icon-spacer w-4 h-4" data-icon-name="save"></span>
      Save
    </button>
  </div>
</template>
```

---

## Popular Icon Names (केही महत्वपूर्ण icons)

### Navigation Icons
```
home, menu, search, settings, arrow-left, arrow-right, 
chevron-left, chevron-right, chevron-up, chevron-down
```

### Action Icons
```
plus, minus, check, x, trash, edit, save, download, upload,
copy, clipboard, refresh, rotate-cw, maximize, minimize
```

### Communication Icons
```
bell, mail, phone, message-circle, message-square, send,
inbox, at-sign, hash
```

### Media Icons
```
play, pause, stop, skip-forward, skip-back, volume-2, 
volume-x, camera, image, video, mic, mic-off
```

### E-commerce Icons
```
shopping-cart, shopping-bag, heart, star, package, 
truck, credit-card, dollar-sign, tag, gift
```

### Status Icons
```
check-circle, x-circle, alert-circle, alert-triangle,
info, help-circle, clock, calendar, lock, unlock
```

### File Icons
```
file, folder, file-text, download, upload, paperclip,
link, external-link
```

### User Icons
```
user, users, user-plus, user-minus, user-check, user-x,
log-in, log-out
```

### Social Icons
```
facebook, twitter, instagram, linkedin, github, youtube,
thumbs-up, thumbs-down, share-2
```

---

## Icon Size Examples (साइज)

```html
<!-- Extra Small (16x16) -->
<span class="dolphin-icon-spacer w-4 h-4" data-icon-name="star"></span>

<!-- Small (20x20) -->
<span class="dolphin-icon-spacer w-5 h-5" data-icon-name="star"></span>

<!-- Medium (24x24) -->
<span class="dolphin-icon-spacer w-6 h-6" data-icon-name="star"></span>

<!-- Large (32x32) -->
<span class="dolphin-icon-spacer w-8 h-8" data-icon-name="star"></span>

<!-- Extra Large (48x48) -->
<span class="dolphin-icon-spacer w-12 h-12" data-icon-name="star"></span>
```

---

## Icon Colors (रङ)

```html
<!-- Tailwind Colors -->
<span class="dolphin-icon-spacer w-6 h-6 text-blue-600" data-icon-name="heart"></span>
<span class="dolphin-icon-spacer w-6 h-6 text-red-500" data-icon-name="alert"></span>
<span class="dolphin-icon-spacer w-6 h-6 text-green-600" data-icon-name="check"></span>
<span class="dolphin-icon-spacer w-6 h-6 text-yellow-500" data-icon-name="star"></span>

<!-- Custom CSS -->
<span class="dolphin-icon-spacer w-6 h-6" 
      style="color: #ff6b6b;" 
      data-icon-name="heart"></span>
```

---

## Complete E-commerce Example

```html
<!DOCTYPE html>
<html lang="ne">
<head>
  <meta charset="UTF-8">
  <title>Dolphin Shop</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  
  <dolphin-store name="products">
    {
      "items": [
        { "id": 1, "name": "Laptop", "price": 999, "inStock": true },
        { "id": 2, "name": "Phone", "price": 599, "inStock": false },
        { "id": 3, "name": "Tablet", "price": 399, "inStock": true }
      ]
    }
  </dolphin-store>

  <div class="container mx-auto p-6">
    <div data-rt-bind="store/products" data-rt-template="#product-grid"></div>
  </div>

  <template id="product-grid">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      {#each items as product}
        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
          
          <!-- Header with package icon -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="dolphin-icon-spacer w-6 h-6 text-blue-600" data-icon-name="package"></span>
              <h3 class="font-bold text-lg">{{product.name}}</h3>
            </div>
            
            <!-- Stock status icon -->
            {#if product.inStock}
              <span class="dolphin-icon-spacer w-5 h-5 text-green-500" data-icon-name="check-circle"></span>
            {:else}
              <span class="dolphin-icon-spacer w-5 h-5 text-red-500" data-icon-name="x-circle"></span>
            {/if}
          </div>

          <!-- Price with dollar icon -->
          <div class="flex items-center gap-2 mb-6">
            <span class="dolphin-icon-spacer w-5 h-5 text-green-600" data-icon-name="dollar-sign"></span>
            <span class="text-2xl font-bold">${{product.price}}</span>
          </div>

          <!-- Action buttons -->
          <div class="flex gap-2">
            <button class="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors">
              <span class="dolphin-icon-spacer w-4 h-4" data-icon-name="shopping-cart"></span>
              <span>कार्टमा थप्नुहोस्</span>
            </button>
            
            <button class="p-2 border-2 border-gray-300 hover:border-red-400 hover:bg-red-50 rounded-lg transition-all">
              <span class="dolphin-icon-spacer w-6 h-6 text-gray-600 hover:text-red-500" data-icon-name="heart"></span>
            </button>
          </div>

        </div>
      {/each}
    </div>
  </template>

  <script src="./dolphin-client.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      window.dolphin = new DolphinModule.DolphinClient();
      window.dolphin.connect().catch(() => console.log('Offline mode'));
    });
  </script>
</body>
</html>
```

---

## कसरी काम गर्छ? (How It Works)

1. **Placeholder Creation**: तपाईंले `dolphin-icon-spacer` भएको span राख्नुहुन्छ
2. **Automatic Detection**: Dolphin ले page load हुँदा यी spacers detect गर्छ
3. **CDN Fetch**: `https://unpkg.com/lucide-static/icons/{icon-name}.svg` बाट SVG download हुन्छ
4. **localStorage Cache**: पहिलो पटक download भएपछि browser cache मा save हुन्छ
5. **DOM Injection**: Spacer span लाई actual SVG content ले replace गर्छ

---

## Performance Tips

✅ **Automatic Caching**: Icons एक पटक मात्र download हुन्छन्, त्यसपछि cache बाट load हुन्छन्

✅ **Lazy Loading**: केवल page मा भएका icons मात्र fetch हुन्छन्

✅ **Lightweight**: प्रत्येक icon केवल 1-2KB SVG file हो

✅ **Offline Support**: Cache भएका icons offline मा पनि काम गर्छन्

---

## सबै Icons हेर्न

**Lucide Icons पूर्ण सूची:** https://lucide.dev/icons/

यो website मा जानुहोस्, icon खोज्नुहोस्, र `data-icon-name` मा kebab-case मा नाम राख्नुहोस्।

**Example:**
- Website मा: `ShoppingCart` → Code मा: `shopping-cart`
- Website मा: `AlertCircle` → Code मा: `alert-circle`
- Website मा: `DollarSign` → Code मा: `dollar-sign`

---

## Troubleshooting

### Icons देखिएन भने:

1. **Internet connection** check गर्नुहोस् (first time load को लागि)
2. **Console** खोलेर error messages हेर्नुहोस्
3. **Icon name** सहि छ कि check गर्नुहोस् (kebab-case मा हुनुपर्छ)
4. **Class** `dolphin-icon-spacer` राखेको छ कि जाँच गर्नुहोस्

### Manual Hydration:

यदि icons automatically load भएनन् भने:

```javascript
// Browser console मा run गर्नुहोस्
if (typeof DolphinModule !== 'undefined' && typeof DolphinModule.hydrateIcons === 'function') {
  DolphinModule.hydrateIcons();
}
```

---

## Summary

- ✅ 1000+ professional icons उपलब्ध
- ✅ Automatic CDN loading र caching
- ✅ Zero bundle size increase
- ✅ Template र conditional rendering support
- ✅ Fully customizable with CSS/Tailwind

**Happy Coding! 🐬**
