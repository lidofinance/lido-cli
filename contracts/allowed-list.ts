import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import abi from 'abi/MEVBoostRelayAllowedList.json';

export const allowedListAddress = getOptionalDeployedAddress('allowedRelayList.address');
export const allowedListContract = new Contract(allowedListAddress, abi, wallet);
