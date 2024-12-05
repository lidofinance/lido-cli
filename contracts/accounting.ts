import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/Accounting.json';

export const accountingAddress = getDeployedAddress('accounting');
export const accountingContract = new Contract(accountingAddress, abi, wallet);
