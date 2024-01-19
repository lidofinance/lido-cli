import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import abi from 'abi/UnlimitedStake.json';

export const unlimitedStakeAddress = getOptionalDeployedAddress('unlimitedStake.address');
export const unlimitedStakeContract = new Contract(unlimitedStakeAddress, abi, wallet);
