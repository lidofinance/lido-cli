import { BaseContract, Contract } from 'ethers';
import { wallet } from '@providers';
import abi from 'abi/AppProxyUpgradeable.json';

export const getAppProxyContract = (getAddress: () => Promise<string>): Contract => {
  return new BaseContract({ getAddress }, abi, wallet) as Contract;
};
