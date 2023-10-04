export const getValueByPath = <T extends Record<string, unknown>>(obj: T, path: string) => {
  const segments = path.split('.');
  let current: unknown = obj;

  for (let i = 0; i < segments.length; i++) {
    if (typeof current === 'object' && current !== null && segments[i] in current) {
      current = (current as T)[segments[i]];
    } else {
      return undefined;
    }
  }

  return current;
};
