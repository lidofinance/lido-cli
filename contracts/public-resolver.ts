import { BaseContract, Contract } from 'ethers';
import { wallet } from '@providers';
import abi from 'abi/PublicReslover.json';

export const getPublicResolverContract = (getAddress: () => Promise<string>): Contract => {
  return new BaseContract({ getAddress }, abi, wallet) as Contract;
};
