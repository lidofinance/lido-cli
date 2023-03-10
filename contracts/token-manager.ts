import { Contract } from 'ethers';
import { wallet } from '@provider';
import { getDeployedAddress } from '@configs';
import abi from 'abi/TokenManager.json';

export const tmAddress = getDeployedAddress('app:aragon-token-manager');
export const tmContract = new Contract(tmAddress, abi, wallet);
