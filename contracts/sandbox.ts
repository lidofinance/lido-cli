import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import abi from 'abi/NodeOperatorsRegistry.json';

export const sandboxAddress = getOptionalDeployedAddress('app:sandbox.proxyAddress', 'app:sandbox.proxy');
export const sandboxContract = new Contract(sandboxAddress, abi, wallet);
