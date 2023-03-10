import { Contract } from 'ethers';
import { wallet } from '@provider';
import { getDeployedAddress } from '@configs';
import abi from 'abi/DepositSecurityModule.json';

export const dsmAddress = getDeployedAddress('depositSecurityModule');
export const dsmContract = new Contract(dsmAddress, abi, wallet);
