import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/TriggerableWithdrawalsGateway.json';

export const twgAddress = getDeployedAddress('triggerableWithdrawalsGateway.implementation');
export const twgContract = new Contract(twgAddress, abi, wallet);