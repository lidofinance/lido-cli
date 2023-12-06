import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/WstETH.json';

export const wstethAddress = getDeployedAddress('wstETH.address');
export const wstethContract = new Contract(wstethAddress, abi, wallet);
