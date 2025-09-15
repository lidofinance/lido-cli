import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import dualGovernanceAbi from 'abi/dg/DualGovernance.json';
import adminExecutorAbi from 'abi/dg/AdminExecutor.json';
import emergencyProtectedTimelockAbi from 'abi/dg/EmergencyProtectedTimelock.json';

export const dualGovernanceAddress = getOptionalDeployedAddress('dg.dualGovernance.address');
export const dualGovernanceContract = new Contract(dualGovernanceAddress, dualGovernanceAbi, wallet);

export const adminExecutorAddress = getOptionalDeployedAddress('dg.adminExecutor.address');
export const adminExecutorContract = new Contract(adminExecutorAddress, adminExecutorAbi, wallet);

export const emergencyProtectedTimelockAddress = getOptionalDeployedAddress('dg.emergencyProtectedTimelock.address');
export const emergencyProtectedTimelockContract = new Contract(
  emergencyProtectedTimelockAddress,
  emergencyProtectedTimelockAbi,
  wallet,
);
