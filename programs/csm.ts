import { program } from '@command';
import { csAccountingContract, csModuleContract, permissionlessGateContract } from '@contracts';
import vettedGateAbi from 'abi/csm/CSVettedGate.json';
import {
  addAccessControlSubCommands,
  addLogsCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
  addPermissionlessNodeOperatorETH,
  addPermissionlessNodeOperatorETHFromFile,
  addPermissionlessNodeOperatorStETH,
  addPermissionlessNodeOperatorStETHFromFile,
  addPermissionlessNodeOperatorWstETH,
  addPermissionlessNodeOperatorWstETHFromFile,
  addVettedNodeOperatorETH,
  addVettedNodeOperatorETHFromFile,
  addVettedNodeOperatorStETH,
  addVettedNodeOperatorStETHFromFile,
  loadProof,
} from './common';
import {
  contractCallTxWithConfirm,
  joinHex,
  logger,
  splitHex,
  supplementAndVerifyDepositDataArray,
  DepositData,
} from '@utils';
import { wallet } from '@providers';
import { Contract, ZeroAddress } from 'ethers';

const csm = program
  .command('csm')
  .aliases(['community-module', 'community-staking-module'])
  .description('interact with community staking module contract');
addAccessControlSubCommands(csm, csModuleContract);
addParsingCommands(csm, csModuleContract);
addLogsCommands(csm, csModuleContract);
addPauseUntilSubCommands(csm, csModuleContract);

const getVettedGateContract = (address: string) => new Contract(address, vettedGateAbi, wallet);

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

    await addPermissionlessNodeOperatorETH({
      accountingContract: csAccountingContract,
      permissionlessGateContract,
      keysCount,
      publicKeys,
      signatures,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
    });
  });

csm
  .command('add-operator-vetted-eth')
  .description('adds node operator through vetted gate using ETH bond')
  .option('-k, --keys-count <number>', 'keys count', '1')
  .option('-p, --public-keys <string>', 'public keys')
  .option('-s, --signatures <string>', 'signatures')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .option('-f, --proof-file <string>', 'merkle proof JSON array file, e.g. ["0x..."]')
  .requiredOption('-g, --gate <address>', 'vetted gate address')
  .action(async (options) => {
    const {
      keysCount,
      publicKeys,
      signatures,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
      proofFile,
      gate,
    } = options;

    await addVettedNodeOperatorETH({
      accountingContract: csAccountingContract,
      vettedGateContract: getVettedGateContract(gate),
      keysCount,
      publicKeys,
      signatures,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
      proof: loadProof(proofFile),
    });
  });

csm
  .command('add-operator-vetted-steth')
  .description('adds node operator through vetted gate using stETH bond')
  .option('-k, --keys-count <number>', 'keys count', '1')
  .option('-p, --public-keys <string>', 'public keys')
  .option('-s, --signatures <string>', 'signatures')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .option('-f, --proof-file <string>', 'merkle proof JSON array file, e.g. ["0x..."]')
  .requiredOption('-g, --gate <address>', 'vetted gate address')
  .action(async (options) => {
    const {
      keysCount,
      publicKeys,
      signatures,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
      proofFile,
      gate,
    } = options;

    await addVettedNodeOperatorStETH({
      accountingContract: csAccountingContract,
      vettedGateContract: getVettedGateContract(gate),
      keysCount,
      publicKeys,
      signatures,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
      proof: loadProof(proofFile),
    });
  });

csm
  .command('add-operator-steth')
  .description('adds node operator using stETH bond')
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

    await addPermissionlessNodeOperatorStETH({
      accountingContract: csAccountingContract,
      permissionlessGateContract,
      keysCount,
      publicKeys,
      signatures,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
    });
  });

csm
  .command('add-operator-wsteth')
  .description('adds node operator using wstETH bond')
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

    await addPermissionlessNodeOperatorWstETH({
      accountingContract: csAccountingContract,
      permissionlessGateContract,
      keysCount,
      publicKeys,
      signatures,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
    });
  });

csm
  .command('add-operator-with-keys-from-file-vetted-eth')
  .description('adds node operator with keys from file through vetted gate using ETH bond')
  .argument('<file-path>', 'file path')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .option('-f, --proof-file <string>', 'merkle proof JSON array file, e.g. ["0x..."]')
  .requiredOption('-g, --gate <address>', 'vetted gate address')
  .action(async (filePath, options) => {
    const { managerAddress, rewardAddress, extendedManagerPermissions, referrer, proofFile, gate } = options;

    await addVettedNodeOperatorETHFromFile(filePath, {
      accountingContract: csAccountingContract,
      vettedGateContract: getVettedGateContract(gate),
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
      proof: loadProof(proofFile),
    });
  });

csm
  .command('add-operator-with-keys-from-file-vetted-steth')
  .description('adds node operator with keys from file through vetted gate using stETH bond')
  .argument('<file-path>', 'file path')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .option('-f, --proof-file <string>', 'merkle proof JSON array file, e.g. ["0x..."]')
  .requiredOption('-g, --gate <address>', 'vetted gate address')
  .action(async (filePath, options) => {
    const { managerAddress, rewardAddress, extendedManagerPermissions, referrer, proofFile, gate } = options;

    await addVettedNodeOperatorStETHFromFile(filePath, {
      accountingContract: csAccountingContract,
      vettedGateContract: getVettedGateContract(gate),
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
      proof: loadProof(proofFile),
    });
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

    await addPermissionlessNodeOperatorETHFromFile(filePath, {
      accountingContract: csAccountingContract,
      permissionlessGateContract,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
    });
  });

csm
  .command('add-operator-with-keys-from-file-steth')
  .description('adds node operator with keys from file using stETH bond')
  .argument('<file-path>', 'file path')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .action(async (filePath, options) => {
    const { managerAddress, rewardAddress, extendedManagerPermissions, referrer } = options;

    await addPermissionlessNodeOperatorStETHFromFile(filePath, {
      accountingContract: csAccountingContract,
      permissionlessGateContract,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
    });
  });

csm
  .command('add-operator-with-keys-from-file-wsteth')
  .description('adds node operator with keys from file using wstETH bond')
  .argument('<file-path>', 'file path')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .action(async (filePath, options) => {
    const { managerAddress, rewardAddress, extendedManagerPermissions, referrer } = options;

    await addPermissionlessNodeOperatorWstETHFromFile(filePath, {
      accountingContract: csAccountingContract,
      permissionlessGateContract,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
    });
  });

csm
  .command('add-keys-from-file-eth')
  .description('adds signing keys from deposit data file')
  .argument('<operator-id>', 'node operator id')
  .argument('<file-path>', 'file path')
  .action(async (operatorId, filePath) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const depositData: DepositData[] = require(filePath);
    await supplementAndVerifyDepositDataArray(depositData);

    const keysCount = depositData.length;
    const value = await csAccountingContract.getRequiredBondForNextKeys(operatorId, keysCount);

    const publicKeys = joinHex(depositData.map(({ pubkey }) => pubkey));
    const signatures = joinHex(depositData.map(({ signature }) => signature));

    await contractCallTxWithConfirm(csModuleContract, 'addValidatorKeysETH', [
      operatorId,
      keysCount,
      publicKeys,
      signatures,
      { value },
    ]);
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
      count = total.totalAddedKeys;
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
