import { Contract } from 'ethers';
import { wallet } from '@provider';
import { getDeployedAddress } from '@configs';
import abi from 'abi/NodeOperatorsRegistry.json';

export const norAddress = getDeployedAddress('app:node-operators-registry');
export const norContract = new Contract(norAddress, abi, wallet);
