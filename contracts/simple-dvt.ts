import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import abi from 'abi/NodeOperatorsRegistry.json';

export const simpleDVTAddress = getOptionalDeployedAddress('app:simple-dvt.proxyAddress', 'app:simple-dvt.proxy');
export const simpleDVTContract = new Contract(simpleDVTAddress, abi, wallet);
