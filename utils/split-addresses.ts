import { ethers } from 'ethers';

export const splitAddresses = (addresses: string): string[] => {
  return addresses
    .trim()
    .split(',')
    .map((address: string) => address.trim())
    .filter((address: string) => address.length > 0)
    .map((address: string) => ethers.getAddress(address));
};
