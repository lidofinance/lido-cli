export const stringify = (input: unknown, space?: string | number) => {
  return JSON.stringify(input, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), space);
};
