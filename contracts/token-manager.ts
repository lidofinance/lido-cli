import { Contract } from 'ethers';
import { wallet } from '@provider';
import deployed from 'deployed-zhejiang.json';
import abi from 'abi/TokenManager.json';

export const tmAddress = deployed['app:aragon-token-manager'].proxyAddress;
export const tmContract = new Contract(tmAddress, abi, wallet);
