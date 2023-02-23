import { Contract } from 'ethers';
import { wallet } from '@provider';
import deployed from 'deployed-zhejiang.json';
import abi from 'abi/DepositSecurityModule.json';

export const dsmAddress = deployed['depositSecurityModule'].address;
export const dsmContract = new Contract(dsmAddress, abi, wallet);
