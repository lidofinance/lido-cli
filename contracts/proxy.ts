import { BaseContract, Contract } from 'ethers';
import { wallet } from '@provider';
import abi from 'abi/OssifiableProxy.json';

export const getProxyContract = (getAddress: () => Promise<string>): Contract => {
  return new BaseContract({ getAddress }, abi, wallet) as Contract;
};
