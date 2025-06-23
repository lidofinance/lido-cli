import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import dgAbi from 'abi/DualGovernance.json';
import timeLockAbi from 'abi/EmergencyProtectedTimelock.json';

export const dualGovernanceAddress = getOptionalDeployedAddress('dualGovernance.dualGovernance.address');
export const dualGovernanceContract = new Contract(dualGovernanceAddress, dgAbi, wallet);

export const dualGovernanceTimeLockAddress = getOptionalDeployedAddress('dualGovernance.timelock.address');
export const dualGovernanceTimeLockContract = new Contract(dualGovernanceTimeLockAddress, timeLockAbi, wallet);

export const getDGContract = (address: string) => new Contract(address, timeLockAbi, wallet);
export const getDGTimeLockContract = (address: string) => new Contract(address, timeLockAbi, wallet);
