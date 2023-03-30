import { Contract } from 'ethers';
import { wallet } from '@providers';
import abi from 'abi/IStakingModule.json';

export const getStakingModuleContract = (address: string) => new Contract(address, abi, wallet);
