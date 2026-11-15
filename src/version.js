export function versionBefore(version, target) {
  const current = version.split('.').map(Number);
  const expected = target.split('.').map(Number);
  for (let index = 0; index < Math.max(current.length, expected.length); index++) {
    const difference = (current[index] ?? 0) - (expected[index] ?? 0);
    if (difference) return difference < 0;
  }
  return false;
}
