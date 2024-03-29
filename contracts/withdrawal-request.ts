import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/WithdrawalQueueERC721.json';

export const withdrawalRequestAddress = getDeployedAddress('withdrawalQueueERC721.proxy', 'withdrawalQueueERC721');
export const withdrawalRequestContract = new Contract(withdrawalRequestAddress, abi, wallet);
