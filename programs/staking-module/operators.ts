import { getStakingModuleContract, norAddress, norContract } from '@contracts';
import { getStakingModules } from './modules';

export type NodeOperator = {
  operatorId: number;
  name: string;
};

export const getNodeOperatorIds = (moduleAddress: string) => {
  const stakingModuleContract = getStakingModuleContract(moduleAddress);
  const nodeOperatorsCount = stakingModuleContract.getNodeOperatorsCount();
  return stakingModuleContract.getNodeOperatorIds(0, nodeOperatorsCount);
};

export const getNodeOperators = async (moduleAddress: string): Promise<NodeOperator[]> => {
  const operatorIdsBigInt: BigInt[] = await getNodeOperatorIds(moduleAddress);
  const operatorIds = operatorIdsBigInt.map((operatorId) => Number(operatorId));

  if (moduleAddress === norAddress) {
    return await Promise.all(
      operatorIds.map(async (operatorId) => {
        const result: { name: string } = await norContract.getNodeOperator(operatorId, true);
        return { operatorId, name: result.name };
      }),
    );
  }

  return operatorIds.map((operatorId) => {
    return { operatorId, name: 'unknown' };
  });
};

export const getNodeOperatorsMap = async (moduleAddress: string) => {
  const nodeOperators = await getNodeOperators(moduleAddress);

  return nodeOperators.reduce((acc, nodeOperator) => {
    acc[nodeOperator.operatorId] = nodeOperator;
    return acc;
  }, {} as Record<number, NodeOperator>);
};

export const getNodeOperatorsMapByModule = async () => {
  const modules = await getStakingModules();

  const modulesWithOperatorsMap = await Promise.all(
    modules.map(async (module) => {
      const operatorsMap = await getNodeOperatorsMap(module.stakingModuleAddress);
      return { moduleId: module.id, operatorsMap };
    }),
  );

  return modulesWithOperatorsMap.reduce((acc, { moduleId, operatorsMap }) => {
    acc[moduleId] = operatorsMap;
    return acc;
  }, {} as Record<number, Record<number, NodeOperator>>);
};
