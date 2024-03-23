export const joinHex = (hexStrings: string[]): string => {
  const formattedString = hexStrings.map((str) => {
    if (str.startsWith('0x')) return str.slice(2);
    return str;
  });

  return `0x${formattedString.join('')}`;
};
