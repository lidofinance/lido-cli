import { Contract } from 'ethers';
import { wallet } from '../wallet';
import deployed from '../deployed-zhejiang.json';
import abi from '../abi/LidoLocator.json';

export const locatorAddress = deployed['lidoLocator'].address;
export const locatorContract = new Contract(locatorAddress, abi, wallet);
