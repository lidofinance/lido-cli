import { Contract } from 'ethers';
import { wallet } from '@provider';
import deployed from 'deployed-zhejiang.json';
import abi from 'abi/NodeOperatorsRegistry.json';

export const norAddress = deployed['app:node-operators-registry'].proxyAddress;
export const norContract = new Contract(norAddress, abi, wallet);
