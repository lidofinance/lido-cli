import { Contract } from 'ethers';
import { wallet } from '../wallet';
import deployed from '../deployed-zhejiang.json';
import abi from '../abi/StakingRouter.json';

export const stakingRouterAddress = deployed['stakingRouter'].address;
export const stakingRouterContract = new Contract(stakingRouterAddress, abi, wallet);
