import { Contract } from 'ethers';
import { wallet } from '@provider';
import deployed from 'deployed-zhejiang.json';
import abi from 'abi/Voting.json';

export const votingAddress = deployed['app:aragon-voting'].proxyAddress;
export const votingContract = new Contract(votingAddress, abi, wallet);
