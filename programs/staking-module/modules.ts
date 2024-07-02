import { stakingRouterContract } from '@contracts';
import { Result } from 'ethers';

export type StakingModule = {
  id: number;
  stakingModuleAddress: string;
  stakingModuleFee: number;
  treasuryFee: number;
  stakeShareLimit: number;
  status: number;
  name: string;
  lastDepositAt: number;
  lastDepositBlock: number;
  exitedValidatorsCount: number;
  priorityExitShareThreshold: number;
  maxDepositsPerBlock: number;
  minDepositBlockDistance: number;
};

export const formatStakingModuleObject = (module: Record<string, bigint | string>): StakingModule => {
  return {
    id: Number(module.id),
    name: String(module.name),
    stakingModuleAddress: String(module.stakingModuleAddress),
    stakingModuleFee: Number(module.stakingModuleFee),
    treasuryFee: Number(module.treasuryFee),
    stakeShareLimit: Number(module.stakeShareLimit),
    status: Number(module.status),
    lastDepositAt: Number(module.lastDepositAt),
    lastDepositBlock: Number(module.lastDepositBlock),
    exitedValidatorsCount: Number(module.exitedValidatorsCount),
    priorityExitShareThreshold: Number(module.priorityExitShareThreshold),
    maxDepositsPerBlock: Number(module.maxDepositsPerBlock),
    minDepositBlockDistance: Number(module.minDepositBlockDistance),
  };
};

export const getStakingModules = async (): Promise<StakingModule[]> => {
  const modules: Result[] = await stakingRouterContract.getStakingModules();
  return modules.map((module) => formatStakingModuleObject(module));
};
