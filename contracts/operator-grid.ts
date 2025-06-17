import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/OperatorGrid.json';

export const operatorGridAddress = getDeployedAddress('operatorGrid');
export const operatorGridContract = new Contract(operatorGridAddress, abi, wallet);
