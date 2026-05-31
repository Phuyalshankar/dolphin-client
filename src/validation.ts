export function validateField(value: string, rulesStr: string, allValues?: Record<string, string>): string | null {
  const rules = rulesStr.split(',');
  for (const rule of rules) {
    const parts = rule.trim().split(':');
    const ruleName = parts[0];
    const ruleArg = parts[1];

    if (ruleName === 'required') {
      if (!value || value.trim() === '') {
        return 'This field is required';
      }
    } else if (ruleName === 'email') {
      if (value && value.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address';
        }
      }
    } else if (ruleName === 'min') {
      const minLen = parseInt(ruleArg, 10);
      if (!value || value.length < minLen) {
        return `Must be at least ${minLen} characters`;
      }
    } else if (ruleName === 'match') {
      if (allValues && value !== allValues[ruleArg]) {
        return `Must match ${ruleArg}`;
      }
    }
  }
  return null;
}

export function attachValidation(clientProto: any) {
  clientProto.validateField = validateField;
}
