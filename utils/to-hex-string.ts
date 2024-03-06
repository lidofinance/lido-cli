export const toHexString = (value: unknown): string => {
  if (typeof value === 'string' && !value.startsWith('0x')) {
    return `0x${value}`;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return `0x${value.toString(16)}`;
  }

  throw new Error('Unsupported value type');
};
