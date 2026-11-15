export function allowedExtensionUrl(value) {
  if (typeof value !== 'string') return false;
  return value === 'chrome://extensions/shortcuts' || value === 'edge://extensions/shortcuts' ||
    value === 'https://mzl.la/3Qwp5QQ' || value === 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Cheatsheet';
}

export function validPagePreference(key, value) {
  const point = (v) => !!v && typeof v === 'object' &&
    ['x', 'y'].every((axis) => Number.isFinite(v[axis]));
  switch (key) {
    case 'callout': return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100;
    case 'barPosition': case 'filterPosition': return point(value);
    case 'counts': return !!value && typeof value === 'object' &&
      ['copy', 'cut', 'move', 'paste'].every((name) => {
        const count = value[name];
        return Number.isSafeInteger(count) && Number(count) >= 0;
      });
    default: return false;
  }
}
