import { getStakingModuleContract, norContract } from '@contracts';
import { getStakingModules } from './modules';

export type NodeOperator = {
  operatorId: number;
  name: string;
};

export const getNodeOperatorIds = async (moduleAddress: string, limit = 500) => {
  const stakingModuleContract = getStakingModuleContract(moduleAddress);
  const nodeOperatorsCount = await stakingModuleContract.getNodeOperatorsCount();
  const operatorIds: bigint[] = [];

  let offset = 0;

  while (offset < nodeOperatorsCount) {
    const result = await stakingModuleContract.getNodeOperatorIds(offset, limit);
    operatorIds.push(...result);
    offset += limit;
  }

  return operatorIds;
};

export const getNodeOperators = async (moduleAddress: string): Promise<NodeOperator[]> => {
  const operatorIdsBigInt: bigint[] = await getNodeOperatorIds(moduleAddress);
  const operatorIds = operatorIdsBigInt.map((operatorId) => Number(operatorId));

  // try to detect name if it's a curated module implementation
  try {
    const moduleContract = norContract.attach(moduleAddress) as typeof norContract;

    return await Promise.all(
      operatorIds.map(async (operatorId) => {
        const result: { name: string } = await moduleContract.getNodeOperator(operatorId, true);
        return { operatorId, name: result.name };
      }),
    );
  } catch {
    return operatorIds.map((operatorId) => {
      return { operatorId, name: 'unknown' };
    });
  }
};

export const getNodeOperatorsMap = async (moduleAddress: string) => {
  const nodeOperators = await getNodeOperators(moduleAddress);

  return nodeOperators.reduce(
    (acc, nodeOperator) => {
      acc[nodeOperator.operatorId] = nodeOperator;
      return acc;
    },
    {} as Record<number, NodeOperator>,
  );
};

export const getNodeOperatorsMapByModule = async () => {
  const modules = await getStakingModules();

  const modulesWithOperatorsMap = await Promise.all(
    modules.map(async (module) => {
      const operatorsMap = await getNodeOperatorsMap(module.stakingModuleAddress);
      return { moduleId: module.id, operatorsMap };
    }),
  );

  return modulesWithOperatorsMap.reduce(
    (acc, { moduleId, operatorsMap }) => {
      acc[moduleId] = operatorsMap;
      return acc;
    },
    {} as Record<number, Record<number, NodeOperator>>,
  );
};
