export function attachI18n(clientProto: any) {
  clientProto._initI18n = function() {
    this.i18n = this.i18n || {
      locale: 'en',
      dicts: {}
    };

    if (typeof document === 'undefined') return;

    // Scan for dynamic dictionaries embedded in HTML
    const dictEls = document.querySelectorAll('[data-i18n-dict]');
    dictEls.forEach((el: any) => {
      const locale = el.getAttribute('data-i18n-dict');
      if (locale) {
        try {
          const dictData = JSON.parse(el.textContent || '{}');
          this.i18n.dicts[locale] = {
            ...(this.i18n.dicts[locale] || {}),
            ...dictData
          };
        } catch (e) {
          console.warn('[Dolphin i18n] Failed to parse dictionary for locale:', locale, e);
        }
      }
    });

    // Detect browser language if locale is not set
    if (!this.i18n.locale && typeof navigator !== 'undefined') {
      const browserLang = navigator.language.split('-')[0];
      if (this.i18n.dicts[browserLang]) {
        this.i18n.locale = browserLang;
      }
    }

    // Bind language switches
    this.addDomListener(document, 'click', (e: any) => {
      const switcher = e.target.closest('[data-i18n-switch]');
      if (switcher) {
        const newLocale = switcher.getAttribute('data-i18n-switch');
        if (newLocale) {
          this.setLocale(newLocale);
        }
      }
    });

    // Trigger initial translations
    this.translateDOM();
  };

  clientProto.setLocale = function(locale: string) {
    this.i18n = this.i18n || { locale: 'en', dicts: {} };
    this.i18n.locale = locale;
    this.translateDOM();
    this.publish('i18n/locale', locale);
  };

  clientProto.translateDOM = function() {
    if (typeof document === 'undefined') return;
    this.i18n = this.i18n || { locale: 'en', dicts: {} };
    const currentLocale = this.i18n.locale || 'en';
    const dict = this.i18n.dicts[currentLocale] || {};

    const translateEls = document.querySelectorAll('[data-i18n-key]');
    translateEls.forEach((el: any) => {
      const key = el.getAttribute('data-i18n-key');
      if (!key) return;

      // Extract translation and resolve dotted keys (e.g. "auth.login")
      let translation = key.split('.').reduce((o: any, i: string) => (o ? o[i] : null), dict);
      if (translation === undefined || translation === null) {
        translation = key; // Fallback to key
      }

      // Interpolate optional attributes data (e.g., data-i18n-params='{"name": "Ram"}')
      const paramsAttr = el.getAttribute('data-i18n-params');
      if (paramsAttr) {
        try {
          const params = JSON.parse(paramsAttr);
          const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          for (const k in params) {
            const escapedK = escapeRegExp(k);
            translation = translation.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, 'g'), params[k]);
          }
        } catch {}
      }

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translation;
      } else {
        el.textContent = translation;
      }
    });
  };
}
