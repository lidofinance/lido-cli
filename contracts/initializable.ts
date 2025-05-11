import { Provider } from 'ethers';

export async function getVersion(provider: Provider, contract: string): Promise<bigint> {
  //  See Initializable.sol
  const INITIALIZABLE_STORAGE = BigInt('0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00');
  const slotValue = await provider.getStorage(contract, INITIALIZABLE_STORAGE);
  return BigInt(slotValue) & (2n ** 64n - 1n);
}
