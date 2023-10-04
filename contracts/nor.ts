import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/NodeOperatorsRegistry.json';

export const norAddress = getDeployedAddress(
  'app:node-operators-registry.proxyAddress',
  'app:node-operators-registry.proxy',
);
export const norContract = new Contract(norAddress, abi, wallet);
