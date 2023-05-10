import { norContract } from '@contracts';
import { getNodeOperators } from './operators';

export type PenalizedNodeOperator = {
  operatorId: number;
  name: string;
  isPenalized: boolean;
  isPenaltyClearable: boolean;
  refundedValidatorsCount: number;
  stuckValidatorsCount: number;
  stuckPenaltyEndTimestamp: number;
};

export const getPenalizedOperators = async () => {
  const address = await norContract.getAddress();
  const operators = await getNodeOperators(address);

  const latestBlock = await norContract.runner?.provider?.getBlock('latest');
  const lastBlockTimestamp = latestBlock?.timestamp;

  if (lastBlockTimestamp == null) {
    throw new Error('The latest block is not available');
  }

  const extendedOperators = await Promise.all(
    operators.map(async ({ name, operatorId }): Promise<PenalizedNodeOperator> => {
      const summary = await norContract.getNodeOperatorSummary(operatorId);
      const refundedValidatorsCount = Number(summary.refundedValidatorsCount);
      const stuckValidatorsCount = Number(summary.stuckValidatorsCount);
      const stuckPenaltyEndTimestamp = Number(summary.stuckPenaltyEndTimestamp);

      const isStuckValidators = refundedValidatorsCount < stuckValidatorsCount;
      const isPenalized = isStuckValidators || lastBlockTimestamp <= stuckPenaltyEndTimestamp;
      const isPenaltyClearable = !isPenalized && stuckPenaltyEndTimestamp != 0;

      return {
        name,
        operatorId,
        isPenalized,
        isPenaltyClearable,
        refundedValidatorsCount,
        stuckValidatorsCount,
        stuckPenaltyEndTimestamp,
      };
    }),
  );

  return extendedOperators.filter(({ isPenalized, isPenaltyClearable }) => isPenalized || isPenaltyClearable);
};
