import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/LidoLocator.json';

export const locatorAddress = getDeployedAddress('lidoLocator.proxy', 'lidoLocator');
export const locatorContract = new Contract(locatorAddress, abi, wallet);

export const getLocatorContract = (address: string) => new Contract(address, abi, wallet);
