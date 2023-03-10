import { Contract } from 'ethers';
import { wallet } from '@provider';
import { getDeployedAddress } from '@configs';
import abi from 'abi/Lido.json';

export const lidoAddress = getDeployedAddress('app:lido');
export const lidoContract = new Contract(lidoAddress, abi, wallet);
