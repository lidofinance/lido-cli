import { Contract } from 'ethers';
import { wallet } from '@provider';
import { getDeployedAddress } from '@configs';
import abi from 'abi/withdrawalQueueERC721.json';

export const withdrawalRequestAddress = getDeployedAddress('withdrawalQueueERC721');
export const withdrawalRequestContract = new Contract(withdrawalRequestAddress, abi, wallet);
