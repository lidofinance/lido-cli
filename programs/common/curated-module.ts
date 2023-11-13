import { Command } from 'commander';
import { Contract } from 'ethers';
import { authorizedCall, contractCallTxWithConfirm, formatDate, logger } from '@utils';
import { getPenalizedOperators } from '../staking-module';

export const addCuratedModuleSubCommands = (command: Command, contract: Contract) => {
  command
    .command('operators')
    .description('returns operators count')
    .action(async () => {
      const total = await contract.getNodeOperatorsCount();
      logger.log('Total', total);
    });

  command
    .command('operator')
    .description('returns operator')
    .argument('<operator-id>', 'operator id')
    .action(async (operatorId) => {
      const operator = await contract.getNodeOperator(operatorId, true);
      logger.log('Operator', operator.toObject());
    });

  command
    .command('operator-summary')
    .description('returns operator summary')
    .argument('<operator-id>', 'operator id')
    .action(async (operatorId) => {
      const summary = await contract.getNodeOperatorSummary(operatorId);
      logger.log('Operator summary', summary.toObject());
    });

  command
    .command('add-operator')
    .description('adds node operator')
    .option('-n, --name <string>', 'operator name')
    .option('-a, --address <string>', 'reward address')
    .action(async (options) => {
      const { name, address } = options;
      await authorizedCall(contract, 'addNodeOperator', [name, address]);
    });

  command
    .command('key')
    .description('returns signing key')
    .argument('<operator-id>', 'operator id')
    .argument('<key-id>', 'key id')
    .action(async (operatorId, keyId) => {
      const keyData = await contract.getSigningKey(Number(operatorId), Number(keyId));
      logger.log('Key', keyData);
    });

  command
    .command('add-keys')
    .description('adds signing keys')
    .option('-o, --operator-id <number>', 'node operator id')
    .option('-c, --count <number>', 'keys count')
    .option('-p, --public-keys <string>', 'public keys')
    .option('-s, --signatures <string>', 'signatures')
    .action(async (options) => {
      const { operatorId, count, publicKeys, signatures } = options;
      await authorizedCall(contract, 'addSigningKeys', [operatorId, count, publicKeys, signatures]);
    });

  command
    .command('remove-keys')
    .description('removes signing keys')
    .option('-o, --operator-id <number>', 'node operator id')
    .option('-i, --from-index <number>', 'from index')
    .option('-c, --count <number>', 'keys count')
    .action(async (options) => {
      const { operatorId, fromIndex, count } = options;
      await authorizedCall(contract, 'removeSigningKeys', [Number(operatorId), Number(fromIndex), Number(count)]);
    });

  command
    .command('set-limit')
    .description('sets staking limit')
    .option('-o, --operator-id <number>', 'node operator id')
    .option('-l, --limit <number>', 'staking limit')
    .action(async (options) => {
      const { operatorId, limit } = options;
      await authorizedCall(contract, 'setNodeOperatorStakingLimit', [operatorId, limit]);
    });

  command
    .command('set-target-limit')
    .description('sets target validators limit')
    .option('-o, --operator-id <number>', 'node operator id')
    .option('-l, --limit <number>', 'target limit')
    .action(async (options) => {
      const { operatorId, limit } = options;
      await authorizedCall(contract, 'updateTargetValidatorsLimits', [operatorId, true, limit]);
    });

  command
    .command('unset-target-limit')
    .description('unsets target validators limit')
    .option('-o, --operator-id <number>', 'node operator id')
    .action(async (options) => {
      const { operatorId } = options;
      await authorizedCall(contract, 'updateTargetValidatorsLimits', [operatorId, false, 0]);
    });

  command
    .command('penalized-operators')
    .description('returns penalties for all operators')
    .action(async () => {
      const penalizedOperators = await getPenalizedOperators();

      if (!penalizedOperators.length) {
        logger.log('No penalized operators');
        return;
      }

      const formattedOperators = penalizedOperators.map((operator) => {
        const { operatorId, name, isPenaltyClearable } = operator;
        const refunded = operator.refundedValidatorsCount;
        const stuck = operator.stuckValidatorsCount;
        const penaltyEndDate = formatDate(new Date(Number(operator.stuckPenaltyEndTimestamp) * 1000));

        return {
          operatorId,
          name,
          refunded,
          stuck,
          penaltyEndDate,
          isPenaltyClearable,
        };
      });

      logger.table(formattedOperators);
    });

  command
    .command('clear-penalty')
    .description('clears node operator penalty')
    .argument('<operator-id>', 'operator id')
    .action(async (operatorId) => {
      await contractCallTxWithConfirm(contract, 'clearNodeOperatorPenalty', [operatorId]);
    });

  command
    .command('clear-penalties')
    .description('clears node operator penalty')
    .action(async () => {
      const penalizedOperators = await getPenalizedOperators();

      if (!penalizedOperators.length) {
        logger.log('No penalized operators');
        return;
      }

      for (const operator of penalizedOperators) {
        logger.log('Operator is penalized', operator.operatorId, operator.name);
        logger.log('Current time', formatDate(new Date()));
        logger.log('Penalty end time', formatDate(new Date(Number(operator.stuckPenaltyEndTimestamp) * 1000)));

        if (operator.isPenaltyClearable) {
          logger.log('Penalty can be cleared');
          await contractCallTxWithConfirm(contract, 'clearNodeOperatorPenalty', [operator.operatorId]);
        } else {
          logger.log('Penalty is not clearable');
        }
      }

      logger.log('All operators are checked');
    });
};
