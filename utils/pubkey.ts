export const validatePubkey = (pubkey: string) => {
  if (pubkey.length !== 96 + 2) throw new Error('Invalid pubkey length');
  if (pubkey.slice(0, 2) !== '0x') throw new Error('Invalid pubkey format');
};
