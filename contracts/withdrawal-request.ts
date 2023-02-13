import { Contract } from 'ethers';
import { wallet } from '../wallet';
import deployed from '../deployed-zhejiang.json';
import abi from '../abi/WithdrawalRequestNFT.json';

export const withdrawalRequestAddress = deployed['withdrawalRequestNFT'].address;
export const withdrawalRequestContract = new Contract(withdrawalRequestAddress, abi, wallet);
