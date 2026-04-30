import { program } from '@command';
import { csAccountingContract, csModuleContract, permissionlessGateContract } from '@contracts';
import vettedGateAbi from 'abi/csm/VettedGate.json';
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
  addVettedNodeOperatorWstETH,
  addVettedNodeOperatorWstETHFromFile,
  claimVettedBondCurve,
  loadProof,
  removeNodeOperatorKeys,
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

type AddOperatorToken = 'eth' | 'steth' | 'wsteth';
type OperatorCommonOptions = {
  managerAddress: string;
  rewardAddress: string;
  extendedManagerPermissions: boolean;
  referrer: string;
};
type AddOperatorOptions = OperatorCommonOptions & {
  keysCount: string;
  publicKeys: string;
  signatures: string;
  token: string;
};
type AddOperatorFromFileOptions = OperatorCommonOptions & {
  token: string;
};
type VettedAddOperatorOptions = AddOperatorOptions & {
  proofFile?: string;
  gate: string;
};
type VettedAddOperatorFromFileOptions = AddOperatorFromFileOptions & {
  proofFile?: string;
  gate: string;
};

const asAddOperatorToken = (token: string): AddOperatorToken => {
  if (token === 'eth' || token === 'steth' || token === 'wsteth') return token;
  throw new Error(`Unsupported token "${token}". Use "eth", "steth", or "wsteth"`);
};

const addPermissionlessNodeOperator = async (token: AddOperatorToken, options: AddOperatorOptions) => {
  const entryOptions = {
    accountingContract: csAccountingContract,
    permissionlessGateContract,
    keysCount: options.keysCount,
    publicKeys: options.publicKeys,
    signatures: options.signatures,
    managerAddress: options.managerAddress,
    rewardAddress: options.rewardAddress,
    extendedManagerPermissions: options.extendedManagerPermissions,
    referrer: options.referrer,
  };

  switch (token) {
    case 'eth':
      return addPermissionlessNodeOperatorETH(entryOptions);
    case 'steth':
      return addPermissionlessNodeOperatorStETH(entryOptions);
    case 'wsteth':
      return addPermissionlessNodeOperatorWstETH(entryOptions);
  }
};

const addVettedNodeOperator = async (token: AddOperatorToken, options: VettedAddOperatorOptions) => {
  const entryOptions = {
    accountingContract: csAccountingContract,
    vettedGateContract: getVettedGateContract(options.gate),
    keysCount: options.keysCount,
    publicKeys: options.publicKeys,
    signatures: options.signatures,
    managerAddress: options.managerAddress,
    rewardAddress: options.rewardAddress,
    extendedManagerPermissions: options.extendedManagerPermissions,
    referrer: options.referrer,
    proof: loadProof(options.proofFile),
  };

  switch (token) {
    case 'eth':
      return addVettedNodeOperatorETH(entryOptions);
    case 'steth':
      return addVettedNodeOperatorStETH(entryOptions);
    case 'wsteth':
      return addVettedNodeOperatorWstETH(entryOptions);
  }
};

const addPermissionlessNodeOperatorFromFile = async (
  token: AddOperatorToken,
  filePath: string,
  options: AddOperatorFromFileOptions,
) => {
  const entryOptions = {
    accountingContract: csAccountingContract,
    permissionlessGateContract,
    managerAddress: options.managerAddress,
    rewardAddress: options.rewardAddress,
    extendedManagerPermissions: options.extendedManagerPermissions,
    referrer: options.referrer,
  };

  switch (token) {
    case 'eth':
      return addPermissionlessNodeOperatorETHFromFile(filePath, entryOptions);
    case 'steth':
      return addPermissionlessNodeOperatorStETHFromFile(filePath, entryOptions);
    case 'wsteth':
      return addPermissionlessNodeOperatorWstETHFromFile(filePath, entryOptions);
  }
};

const addVettedNodeOperatorFromFile = async (
  token: AddOperatorToken,
  filePath: string,
  options: VettedAddOperatorFromFileOptions,
) => {
  const entryOptions = {
    accountingContract: csAccountingContract,
    vettedGateContract: getVettedGateContract(options.gate),
    managerAddress: options.managerAddress,
    rewardAddress: options.rewardAddress,
    extendedManagerPermissions: options.extendedManagerPermissions,
    referrer: options.referrer,
    proof: loadProof(options.proofFile),
  };

  switch (token) {
    case 'eth':
      return addVettedNodeOperatorETHFromFile(filePath, entryOptions);
    case 'steth':
      return addVettedNodeOperatorStETHFromFile(filePath, entryOptions);
    case 'wsteth':
      return addVettedNodeOperatorWstETHFromFile(filePath, entryOptions);
  }
};

const addValidatorKeysETH = async (
  operatorId: string,
  keysCount: string | number,
  publicKeys: string,
  signatures: string,
  bond: boolean,
) => {
  const value = bond ? await csAccountingContract.getRequiredBondForNextKeys(operatorId, keysCount) : 0n;

  await contractCallTxWithConfirm(csModuleContract, 'addValidatorKeysETH(address,uint256,uint256,bytes,bytes)', [
    wallet.address,
    operatorId,
    keysCount,
    publicKeys,
    signatures,
    { value },
  ]);
};

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
  .command('add-operator')
  .description('adds node operator')
  .option('-k, --keys-count <number>', 'keys count', '1')
  .option('-p, --public-keys <string>', 'public keys')
  .option('-s, --signatures <string>', 'signatures')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .requiredOption('-t, --token <token>', 'bond token: eth, steth, or wsteth')
  .action(async (options: AddOperatorOptions) => {
    await addPermissionlessNodeOperator(asAddOperatorToken(options.token), options);
  });

csm
  .command('add-operator-vetted')
  .description('adds node operator through vetted gate')
  .option('-k, --keys-count <number>', 'keys count', '1')
  .option('-p, --public-keys <string>', 'public keys')
  .option('-s, --signatures <string>', 'signatures')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .option('-f, --proof-file <string>', 'merkle proof JSON array file, e.g. ["0x..."]')
  .requiredOption('-t, --token <token>', 'bond token: eth, steth, or wsteth')
  .requiredOption('-g, --gate <address>', 'vetted gate address')
  .action(async (options: VettedAddOperatorOptions) => {
    await addVettedNodeOperator(asAddOperatorToken(options.token), options);
  });

csm
  .command('claim-vetted-bond-curve')
  .description('claims vetted gate bond curve for an existing node operator')
  .argument('<operator-id>', 'node operator id')
  .option('-f, --proof-file <string>', 'merkle proof JSON array file, e.g. ["0x..."]')
  .requiredOption('-g, --gate <address>', 'vetted gate address')
  .action(async (operatorId, options) => {
    const { proofFile, gate } = options;

    await claimVettedBondCurve(getVettedGateContract(gate), operatorId, loadProof(proofFile));
  });

csm
  .command('add-operator-with-keys-from-file-vetted')
  .description('adds node operator with keys from file through vetted gate')
  .argument('<file-path>', 'file path')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .option('-f, --proof-file <string>', 'merkle proof JSON array file, e.g. ["0x..."]')
  .requiredOption('-t, --token <token>', 'bond token: eth, steth, or wsteth')
  .requiredOption('-g, --gate <address>', 'vetted gate address')
  .action(async (filePath: string, options: VettedAddOperatorFromFileOptions) => {
    await addVettedNodeOperatorFromFile(asAddOperatorToken(options.token), filePath, options);
  });

csm
  .command('add-operator-with-keys-from-file')
  .description('adds node operator with keys from file')
  .argument('<file-path>', 'file path')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .requiredOption('-t, --token <token>', 'bond token: eth, steth, or wsteth')
  .action(async (filePath: string, options: AddOperatorFromFileOptions) => {
    await addPermissionlessNodeOperatorFromFile(asAddOperatorToken(options.token), filePath, options);
  });

csm
  .command('remove-keys')
  .alias('delete-keys')
  .description('removes signing keys')
  .argument('<operator-id>', 'node operator id')
  .argument('<start-index>', 'first key index to remove')
  .argument('<keys-count>', 'keys count')
  .action(async (operatorId, startIndex, keysCount) => {
    await removeNodeOperatorKeys(csModuleContract, operatorId, startIndex, keysCount);
  });

csm
  .command('add-keys')
  .description('adds signing keys')
  .argument('<operator-id>', 'node operator id')
  .argument('<keys-count>', 'keys count')
  .argument('<public-keys>', 'public keys')
  .argument('<signatures>', 'signatures')
  .option('--no-bond', 'do not send bond with this command')
  .action(async (operatorId, keysCount, publicKeys, signatures, options) => {
    await addValidatorKeysETH(operatorId, keysCount, publicKeys, signatures, options.bond);
  });

csm
  .command('add-keys-from-file-eth')
  .description('adds signing keys from deposit data file')
  .argument('<operator-id>', 'node operator id')
  .argument('<file-path>', 'file path')
  .option('--no-bond', 'do not send bond with this command')
  .action(async (operatorId, filePath, options) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const depositData: DepositData[] = require(filePath);
    await supplementAndVerifyDepositDataArray(depositData);

    await addValidatorKeysETH(
      operatorId,
      depositData.length,
      joinHex(depositData.map(({ pubkey }) => pubkey)),
      joinHex(depositData.map(({ signature }) => signature)),
      options.bond,
    );
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
