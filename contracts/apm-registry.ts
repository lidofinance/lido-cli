import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/aragon/APMRegistry.json';

export const lidoApmAddress = getDeployedAddress('lidoApm');
export const lidoApmContract = new Contract(lidoApmAddress, abi, wallet);
