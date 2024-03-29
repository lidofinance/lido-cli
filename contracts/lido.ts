import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/Lido.json';

export const lidoAddress = getDeployedAddress('app:lido.proxyAddress', 'app:lido.proxy');
export const lidoContract = new Contract(lidoAddress, abi, wallet);
