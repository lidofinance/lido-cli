import { Contract } from 'ethers';
import { wallet } from '@provider';
import { getDeployedAddress } from '@configs';
import abi from 'abi/Voting.json';

export const votingAddress = getDeployedAddress('app:aragon-voting');
export const votingContract = new Contract(votingAddress, abi, wallet);
