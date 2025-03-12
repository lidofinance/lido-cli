import { program } from '@command';
import { csAccountingContract, csModuleContract, getCSMVersion, permissionslessGateContract } from '@contracts';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands, addPauseUntilSubCommands } from './common';
import {
  contractCallTxWithConfirm,
  joinHex,
  logger,
  splitHex,
  supplementAndVerifyDepositDataArray,
  DepositData,
} from '@utils';
import { wallet } from '@providers';
import { ZeroAddress } from 'ethers';

const csm = program
  .command('csm')
  .aliases(['community-module', 'community-staking-module'])
  .description('interact with community staking module contract');
addAccessControlSubCommands(csm, csModuleContract);
addParsingCommands(csm, csModuleContract);
addLogsCommands(csm, csModuleContract);
addPauseUntilSubCommands(csm, csModuleContract);

csm
  .command('operators')
  .description('returns operators count')
  .action(async () => {
    const total = await csModuleContract.getNodeOperatorsCount();
    logger.log('Total', Number(total));
  });

csm
  .command('operator')
  .description('returns operator')
  .argument('<operator-id>', 'operator id')
  .action(async (operatorId) => {
    const operator = await csModuleContract.getNodeOperator(operatorId);
    logger.log('Operator', operator.toObject());
  });

csm
  .command('operator-summary')
  .description('returns operator summary')
  .argument('<operator-id>', 'operator id')
  .action(async (operatorId) => {
    const summary = await csModuleContract.getNodeOperatorSummary(operatorId);
    logger.log('Operator summary', summary.toObject());
  });

csm
  .command('add-operator-eth')
  .description('adds node operator')
  .option('-k, --keys-count <number>', 'keys count', '1')
  .option('-p, --public-keys <string>', 'public keys')
  .option('-s, --signatures <string>', 'signatures')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .action(async (options) => {
    const { keysCount, publicKeys, signatures, managerAddress, rewardAddress, extendedManagerPermissions, referrer } =
      options;

    const csmVersion = await getCSMVersion(wallet.provider);

    const curveId = await csAccountingContract.DEFAULT_BOND_CURVE_ID();
    const value = await csAccountingContract['getBondAmountByKeysCount(uint256,uint256)'](keysCount, curveId);

    if (csmVersion < 2) {
      await contractCallTxWithConfirm(csModuleContract, 'addNodeOperatorETH', [
        keysCount,
        publicKeys,
        signatures,
        [managerAddress, rewardAddress, !!extendedManagerPermissions],
        [], // early adoption proof
        referrer,
        { value },
      ]);
    } else {
      await contractCallTxWithConfirm(permissionslessGateContract, 'addNodeOperatorETH', [
        keysCount,
        publicKeys,
        signatures,
        [managerAddress, rewardAddress, !!extendedManagerPermissions],
        referrer,
        { value },
      ]);
    }
  });

csm
  .command('add-operator-with-keys-from-file')
  .description('adds node operator with keys from file')
  .argument('<file-path>', 'file path')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .action(async (filePath, options) => {
    const { managerAddress, rewardAddress, extendedManagerPermissions, referrer } = options;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const depositData: DepositData[] = require(filePath);
    await supplementAndVerifyDepositDataArray(depositData);

    const csmVersion = await getCSMVersion(wallet.provider);

    const curveId = await csAccountingContract.DEFAULT_BOND_CURVE_ID();
    const keysCount = depositData.length;
    const value = await csAccountingContract['getBondAmountByKeysCount(uint256,uint256)'](keysCount, curveId);

    const publicKeys = joinHex(depositData.map(({ pubkey }) => pubkey));
    const signatures = joinHex(depositData.map(({ signature }) => signature));

    if (csmVersion < 2) {
      await contractCallTxWithConfirm(csModuleContract, 'addNodeOperatorETH', [
        keysCount,
        publicKeys,
        signatures,
        [managerAddress, rewardAddress, !!extendedManagerPermissions],
        [], // early adoption proof
        referrer,
        { value },
      ]);
    } else {
      await contractCallTxWithConfirm(permissionslessGateContract, 'addNodeOperatorETH', [
        keysCount,
        publicKeys,
        signatures,
        [managerAddress, rewardAddress, !!extendedManagerPermissions],
        referrer,
        { value },
      ]);
    }
  });

csm
  .command('change-reward-address')
  .description('change reward address')
  .option('-i, --operator-id <number>', 'node operator id')
  .option('-a, --reward-address <string>', 'new reward address')
  .action(async (options) => {
    const { operatorId, rewardAddress } = options;

    await contractCallTxWithConfirm(csModuleContract, 'changeNodeOperatorRewardAddress', [operatorId, rewardAddress]);
  });

csm
  .command('keys')
  .description('returns signing keys')
  .argument('<operator-id>', 'operator id')
  .argument('[from-index]', 'from index')
  .argument('[count]', 'keys count')
  .action(async (operatorId, fromIndex, count) => {
    if (fromIndex == null && count == null) {
      const total = await csModuleContract.getNodeOperator(operatorId);

      fromIndex = 0;
      count = total.totalAddedValidators;
    }

    const [pubkeys, signatures] = await csModuleContract.getSigningKeysWithSignatures(
      Number(operatorId),
      Number(fromIndex),
      Number(count),
    );

    const pubkeysArray = splitHex(pubkeys, 48 * 2);
    const signaturesArray = splitHex(signatures, 96 * 2);

    const keysData = pubkeysArray.map((pubkey: string, index: number) => ({
      pubkey,
      signature: signaturesArray[index],
    }));

    logger.log('Keys', keysData);
  });
