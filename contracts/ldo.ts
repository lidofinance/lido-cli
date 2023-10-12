import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/MiniMeToken.json';

export const ldoAddress = getDeployedAddress('ldo');
export const ldoContract = new Contract(ldoAddress, abi, wallet);
