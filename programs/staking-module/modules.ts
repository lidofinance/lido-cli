import { stakingRouterContract } from '@contracts';
import { Result } from 'ethers';
import { getNodeOperators } from './operators';
import { logger } from '@utils';
import Table from 'cli-table3';
import chalk from 'chalk';

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

const ok = chalk.green.bold;
const warn = chalk.yellow.bold;
const head = chalk.white.bold;

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

export const getNodeOperatorDigests = async (moduleId: number, operatorIds: number[], batchLimit = 100) => {
  const digests: Result[] = [];

  let offset = 0;
  let result = [];

  do {
    const batchIds = operatorIds.slice(offset, offset + batchLimit);
    result = await stakingRouterContract['getNodeOperatorDigests(uint256,uint256[])'](moduleId, batchIds);
    digests.push(...result);
    offset += batchLimit;
  } while (result.length == batchLimit);

  return digests;
};

export const getAllNodeOperatorDigests = async (moduleId: number, limit = 100) => {
  const digests: Result[] = [];

  let offset = 0;
  let result = [];

  do {
    result = await stakingRouterContract['getNodeOperatorDigests(uint256,uint256,uint256)'](moduleId, offset, limit);
    digests.push(...result);
    offset += limit;
  } while (result.length == limit);

  return digests;
};

export const printModuleDigest = async (module: StakingModule) => {
  const operators = await getNodeOperators(module.stakingModuleAddress);
  const operatorIds = operators.map(({ operatorId }) => operatorId);
  const digests = await getNodeOperatorDigests(module.id, operatorIds);

  const operatorsTable = new Table({
    head: [
      'OpId',
      'Name',
      'Status',
      'Target',
      'Active',
      'Refunded',
      'Stuck',
      'Stuck TS',
      'Depositable',
      'Exited',
      'Deposited',
    ],
    colAligns: ['right', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
    style: { head: ['gray'], compact: true },
  });

  operators.map((operator, index) => {
    const { operatorId, name } = operator;
    const { isActive, summary } = digests[index].toObject();
    const {
      targetLimitMode,
      targetValidatorsCount,
      stuckValidatorsCount,
      refundedValidatorsCount,
      stuckPenaltyEndTimestamp,
      totalExitedValidators,
      depositableValidatorsCount,
      totalDepositedValidators,
    } = summary;

    const targetLimitDesc = [null, 'Soft', 'Hard'][targetLimitMode];
    const targetValidatorsText = warn(Number(targetValidatorsCount));

    operatorsTable.push([
      operatorId,
      head(name),
      isActive ? ok('Active') : warn('Disabled'),
      targetLimitMode > 0 ? `${targetValidatorsText} ${targetLimitDesc}` : null,
      Number(totalDepositedValidators - totalExitedValidators),
      Number(refundedValidatorsCount),
      stuckValidatorsCount ? warn(Number(stuckValidatorsCount)) : 0,
      stuckPenaltyEndTimestamp ? warn(Number(stuckPenaltyEndTimestamp)) : null,
      depositableValidatorsCount ? ok(Number(depositableValidatorsCount)) : 0,
      Number(totalExitedValidators),
      Number(totalDepositedValidators),
    ]);

    return {};
  });

  logger.log();
  logger.log('Module', module.id, module.stakingModuleAddress);
  logger.log(operatorsTable.toString());
};
