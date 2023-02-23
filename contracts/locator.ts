import { Contract } from 'ethers';
import { wallet } from '@provider';
import deployed from 'deployed-zhejiang.json';
import abi from 'abi/LidoLocator.json';

export const locatorAddress = deployed['lidoLocator'].address;
export const locatorContract = new Contract(locatorAddress, abi, wallet);

export const getLocatorContract = (address: string) => new Contract(address, abi, wallet);
