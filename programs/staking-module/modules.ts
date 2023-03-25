import { stakingRouterContract } from '@contracts';

export type StakingModule = {
  id: number;
  stakingModuleAddress: string;
  stakingModuleFee: number;
  treasuryFee: number;
  targetShare: number;
  status: number;
  name: string;
  lastDepositAt: number;
  lastDepositBlock: number;
  exitedValidatorsCount: number;
};

export const getStakingModules = async (): Promise<StakingModule[]> => {
  const modules = await stakingRouterContract.getStakingModules();
  return modules.map((module) => {
    const {
      id,
      stakingModuleAddress,
      stakingModuleFee,
      treasuryFee,
      targetShare,
      status,
      name,
      lastDepositAt,
      lastDepositBlock,
      exitedValidatorsCount,
    } = module.toObject();

    return {
      id: Number(id),
      name,
      stakingModuleAddress,
      stakingModuleFee: Number(stakingModuleFee),
      treasuryFee: Number(treasuryFee),
      targetShare: Number(targetShare),
      status: Number(status),
      lastDepositAt: Number(lastDepositAt),
      lastDepositBlock: Number(lastDepositBlock),
      exitedValidatorsCount: Number(exitedValidatorsCount),
    };
  });
};
