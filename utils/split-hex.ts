export const splitHex = (hexString: string, chunkLength: number) => {
  if (!Number.isInteger(chunkLength) || chunkLength < 1) {
    throw new RangeError('chunkLength should be positive integer');
  }

  if (typeof hexString !== 'string' || !hexString.match(/^0x[0-9A-Fa-f]*$/)) {
    throw new Error('hexString is not a hex-like string');
  }

  const parts: string[] = [];
  let part = '';
  // start from index 2 because each record beginning from 0x
  for (let i = 2; i < hexString.length; i++) {
    part += hexString[i];
    if (part.length === chunkLength) {
      parts.push(`0x${part}`);
      part = '';
    }
  }
  return parts;
};
