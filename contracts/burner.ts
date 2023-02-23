import { Contract } from 'ethers';
import { wallet } from '@provider';
import deployed from 'deployed-zhejiang.json';
import abi from 'abi/Burner.json';

export const burnerAddress = deployed['burner'].address;
export const burnerContract = new Contract(burnerAddress, abi, wallet);
