import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/ENS.json';

export const ensAddress = getDeployedAddress('ensAddress');
export const ensContract = new Contract(ensAddress, abi, wallet);
