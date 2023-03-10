import { Contract } from 'ethers';
import { wallet } from '@provider';
import { getDeployedAddress } from '@configs';
import abi from 'abi/Burner.json';

export const burnerAddress = getDeployedAddress('burner');
export const burnerContract = new Contract(burnerAddress, abi, wallet);
