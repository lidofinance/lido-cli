import { BaseContract, Contract } from 'ethers';
import { wallet } from '@providers';
import abi from 'abi/Repo.json';

export const getRepoContract = (getAddress: () => Promise<string>): Contract => {
  return new BaseContract({ getAddress }, abi, wallet) as Contract;
};
