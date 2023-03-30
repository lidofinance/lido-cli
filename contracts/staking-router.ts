import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/StakingRouter.json';

export const stakingRouterAddress = getDeployedAddress('stakingRouter');
export const stakingRouterContract = new Contract(stakingRouterAddress, abi, wallet);
