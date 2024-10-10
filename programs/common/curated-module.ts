import { Command } from 'commander';
import { Contract, EventLog, concat, toBeHex } from 'ethers';
import {
  authorizedCall,
  contractCallTxWithConfirm,
  formatDate,
  getLatestBlock,
  joinHex,
  logger,
  splitHex,
} from '@utils';
import { getPenalizedOperators } from '../staking-module';
import { aclContract } from '@contracts';
import { DepositData, supplementAndVerifyDepositDataArray } from 'utils/deposit-data';

export const addCuratedModuleSubCommands = (command: Command, contract: Contract) => {
  command
    .command('operators')
    .description('returns operators count')
    .action(async () => {
      const total = await contract.getNodeOperatorsCount();
      logger.log('Total', Number(total));
    });

  command
    .command('operator-list')
    .description('returns list of operators')
    .action(async () => {
      const total = await contract.getNodeOperatorsCount();
      const operatorIds = new Array(Number(total)).fill(0).map((_, index) => index);

      const result = await Promise.all(
        operatorIds.map(async (operatorId) => {
          const operator = await contract.getNodeOperator(operatorId, true);
          const parsed = operator.toObject();

          return {
            active: parsed.active,
            name: parsed.name,
            rewardAddress: parsed.rewardAddress,
            vetted: parsed.totalVettedValidators,
            exited: parsed.totalExitedValidators,
            deposited: parsed.totalDepositedValidators,
            total: parsed.totalAddedValidators,
          };
        }),
      );

      logger.table(result);
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
    .command('rename-operator')
    .description('renames node operator')
    .argument('<operator-id>', 'operator id')
    .argument('<name>', 'operator name')
    .action(async (operatorId, name) => {
      await authorizedCall(contract, 'setNodeOperatorName', [Number(operatorId), name]);
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
    .command('keys')
    .description('returns signing keys')
    .argument('<operator-id>', 'operator id')
    .argument('[from-index]', 'from index')
    .argument('[count]', 'keys count')
    .action(async (operatorId, fromIndex, count) => {
      if (fromIndex == null && count == null) {
        const total = await contract.getNodeOperator(operatorId, true);

        fromIndex = 0;
        count = total.totalAddedValidators;
      }

      const [pubkeys, signatures, used] = await contract.getSigningKeys(
        Number(operatorId),
        Number(fromIndex),
        Number(count),
      );

      const pubkeysArray = splitHex(pubkeys, 48 * 2);
      const signaturesArray = splitHex(signatures, 96 * 2);

      const keysData = pubkeysArray.map((pubkey: string, index: number) => ({
        pubkey,
        signature: signaturesArray[index],
        used: used[index],
      }));

      logger.log('Keys', keysData);
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
    .command('add-keys-from-file')
    .description('adds signing keys from deposit data file')
    .argument('<operator-id>', 'node operator id')
    .argument('<file-path>', 'file path')
    .action(async (operatorId, filePath) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const depositData: DepositData[] = require(filePath);
      await supplementAndVerifyDepositDataArray(depositData);

      const count = depositData.length;
      const publicKeys = joinHex(depositData.map(({ pubkey }) => pubkey));
      const signatures = joinHex(depositData.map(({ signature }) => signature));

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
    .option('-h, --hard-limit', 'hard limit', false)
    .action(async (options) => {
      const { operatorId, limit, hardLimit } = options;
      await authorizedCall(contract, 'updateTargetValidatorsLimits', [operatorId, hardLimit ? 2 : 1, limit]);
    });

  command
    .command('unset-target-limit')
    .description('unsets target validators limit')
    .option('-o, --operator-id <number>', 'node operator id')
    .action(async (options) => {
      const { operatorId } = options;
      await authorizedCall(contract, 'updateTargetValidatorsLimits', [operatorId, 0, 0]);
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

  command
    .command('set-reward-address')
    .description('sets node operator reward address')
    .argument('<operator-id>', 'operator id')
    .argument('<address>', 'reward address')
    .action(async (operatorId, address) => {
      await authorizedCall(contract, 'setNodeOperatorRewardAddress', [operatorId, address]);
    });

  command
    .command('manager-addresses')
    .description('returns manager addresses list')
    .option('-b, --blocks <number>', 'blocks', '1000000000')
    .action(async (options) => {
      const { blocks } = options;
      const simpleDVTAddress = await contract.getAddress();
      const role = await contract.MANAGE_SIGNING_KEYS();

      const latestBlock = await getLatestBlock();
      const toBlock = latestBlock.number;
      const fromBlock = Math.max(toBlock - Number(blocks), 0);

      const filter = aclContract.filters.SetPermission(null, simpleDVTAddress, role);
      const logs = await aclContract.queryFilter(filter, fromBlock, toBlock);

      const result = await Promise.all(
        logs.map(async (log) => {
          if (!(log instanceof EventLog)) throw new Error('Failed to parse log');

          try {
            const managerAddress = log.args[0];
            const roleParams = await aclContract.getPermissionParam(managerAddress, simpleDVTAddress, role, 0);

            const [, , operatorId] = roleParams;

            return { operatorId, managerAddress };
          } catch {
            // ignore if role has no params
          }
        }),
      );

      const filteredResult = result.filter((v) => v);
      const sortedResult = filteredResult.sort((a, b) => Number(a?.operatorId) - Number(b?.operatorId));

      if (sortedResult.length) {
        logger.table(sortedResult);
      } else {
        logger.log('No manager addresses');
      }
    });

  command
    .command('grant-manager-role')
    .description('grants manager role')
    .argument('<operator-id>', 'operator id')
    .argument('<address>', 'address')
    .action(async (operatorId, address) => {
      const role = await contract.MANAGE_SIGNING_KEYS();
      const simpleDVTAddress = await contract.getAddress();

      // https://legacy-docs.aragon.org/developers/tools/aragonos/reference-aragonos-3#parameter-interpretation
      const op = toBeHex(1, 1); // Op.EQ = 1
      const id = toBeHex(0, 1); // Param id = 0
      const value = toBeHex(operatorId, 30);
      const params = [concat([id, op, value])];

      await authorizedCall(aclContract, 'grantPermissionP', [address, simpleDVTAddress, role, params]);
    });
};
