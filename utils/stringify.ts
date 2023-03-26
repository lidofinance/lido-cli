export const stringify = (input: unknown) => {
  return JSON.stringify(input, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
};
