import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/Burner.json';

export const burnerAddress = getDeployedAddress('burner');
export const burnerContract = new Contract(burnerAddress, abi, wallet);
