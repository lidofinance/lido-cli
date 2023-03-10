import { Contract } from 'ethers';
import { wallet } from '@provider';
import { getDeployedAddress } from '@configs';
import abi from 'abi/LidoLocator.json';

export const locatorAddress = getDeployedAddress('lidoLocator');
export const locatorContract = new Contract(locatorAddress, abi, wallet);

export const getLocatorContract = (address: string) => new Contract(address, abi, wallet);
