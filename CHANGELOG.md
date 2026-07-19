# Changelog

## [1.2.7] - 2025-01-XX

### 🐛 Bug Fixes
- **Type Safety in Test Environment**: Added type guards for DOM element methods
  - Fixed `el.querySelector is not a function` error in rt-bindings.ts
  - Fixed `el.hasAttribute is not a function` error in module-bindings.ts
  - Fixed `window.location.origin` undefined error in core.ts
  
### ✅ Tests
- All 127 tests now passing (previously 17 failures)
- Improved test compatibility with Jest environment
- Enhanced DOM element type checking

### 📝 Documentation
- Added complete icon usage guide in Nepali (`icon-guide-nepali.md`)
- Added working examples: login form with icons, products debug templates

---

## [1.2.6] - Previous Release

### Features
- Initial icon system implementation
- Template rendering improvements
- Store management enhancements
