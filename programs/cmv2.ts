import { program } from '@command';
import {
  cmv2AccountingContract,
  cmv2ModuleContract,
  cmv2CuratedGateContract,
  cmv2CuratedGateAddress,
  cmv2PermissionlessGateContract,
  cmv2PermissionlessGateAddress,
  cmv2VettedGateContract,
  cmv2VettedGateAddress,
  stakingRouterContract,
} from '@contracts';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands, addPauseUntilSubCommands } from './common';
import { encodeFromAgent, votingNewVote } from '@scripts';
import {
  CallScriptAction,
  authorizedCall,
  contractCallTxWithConfirm,
  encodeCallScript,
  forwardVoteFromTm,
  joinHex,
  logger,
  splitHex,
  supplementAndVerifyDepositDataArray,
  DepositData,
} from '@utils';
import { wallet } from '@providers';
import { Contract, Interface, ZeroAddress, id } from 'ethers';
import { existsSync, readFileSync } from 'fs';
import { basename, extname, resolve } from 'path';

const loadProof = (filePath?: string) => {
  if (!filePath) return [] as string[];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const data = require(filePath);
  if (Array.isArray(data)) return data as string[];
  if (data && typeof data === 'object') {
    const addr = wallet.address.toLowerCase();
    const proof = data[addr] ?? data[addr.replace('0x', '')];
    return Array.isArray(proof) ? proof : ([] as string[]);
  }
  return [] as string[];
};

const getMerkleGateContract = () => {
  if (cmv2CuratedGateAddress !== ZeroAddress) return cmv2CuratedGateContract;
  if (cmv2VettedGateAddress !== ZeroAddress) return cmv2VettedGateContract;
  return null;
};

const cmv2ModuleMetaAbi = ['function META_REGISTRY() view returns (address)'];
const metaRegistryAbi = [
  'function NO_GROUP_ID() view returns (uint256)',
  'function createOrUpdateOperatorGroup(uint256,(tuple(uint64 nodeOperatorId,uint16 share)[] subNodeOperators, tuple(bytes data)[] externalOperators))',
];
const accessControlAbi = ['function grantRole(bytes32,address)'];
const parametersRegistryAbi = [
  'function MANAGE_ALLOCATION_WEIGHTS_ROLE() view returns (bytes32)',
  'function defaultDepositAllocationWeight() view returns (uint256)',
  'function setDefaultDepositAllocationWeight(uint256)',
  'function hasRole(bytes32,address) view returns (bool)',
];

const ensureMetaRegistryGroup = async (nodeOperatorId: bigint) => {
  let metaRegistryAddress: string | undefined;
  try {
    metaRegistryAddress = await new Contract(
      await cmv2ModuleContract.getAddress(),
      cmv2ModuleMetaAbi,
      wallet,
    ).META_REGISTRY();
  } catch (error) {
    logger.warn('META_REGISTRY() call reverted on CMv2 module; skipping operator group update');
    return;
  }

  if (!metaRegistryAddress || metaRegistryAddress === ZeroAddress) {
    logger.warn('MetaRegistry address not found on CMv2 module; skipping operator group update');
    return;
  }

  const metaRegistry = new Contract(metaRegistryAddress, metaRegistryAbi, wallet);
  const groupId = await metaRegistry.NO_GROUP_ID();
  const subNodeOperators = [{ nodeOperatorId, share: 10000n }];

  try {
    await contractCallTxWithConfirm(metaRegistry, 'createOrUpdateOperatorGroup', [
      groupId,
      { subNodeOperators, externalOperators: [] },
    ]);
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    logger.warn(`MetaRegistry createOrUpdateOperatorGroup reverted; skipping: ${message}`);
  }
};

const resolveParametersRegistryAddress = (override?: string): string => {
  if (override && override !== ZeroAddress) return override;
  if (process.env.CMV2_PARAMETERS_REGISTRY_ADDRESS && process.env.CMV2_PARAMETERS_REGISTRY_ADDRESS !== ZeroAddress) {
    return process.env.CMV2_PARAMETERS_REGISTRY_ADDRESS;
  }

  const statePath = resolve(process.cwd(), '../state.json');
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    const address = state?.cmv2?.ParametersRegistry;
    if (address && address !== ZeroAddress) return address;
  }

  const deployPath = resolve(process.cwd(), '../cmv2/artifacts/latest/curated/deploy-local-devnet.json');
  if (existsSync(deployPath)) {
    const deployment = JSON.parse(readFileSync(deployPath, 'utf8'));
    const address = deployment?.ParametersRegistry;
    if (address && address !== ZeroAddress) return address;
  }

  throw new Error(
    'ParametersRegistry address not found. Pass --parameters-registry or set CMV2_PARAMETERS_REGISTRY_ADDRESS',
  );
};

const setDefaultDepositAllocationWeight = async (weight: bigint, parametersRegistryAddress: string) => {
  const parametersRegistry = new Contract(parametersRegistryAddress, parametersRegistryAbi, wallet);
  const readonlyRunner = wallet.provider ?? wallet;
  const parametersRegistryReadonly = new Contract(parametersRegistryAddress, parametersRegistryAbi, readonlyRunner);
  let before: bigint | null = null;
  try {
    before = await parametersRegistryReadonly.defaultDepositAllocationWeight();
  } catch (error) {
    logger.warn(
      `defaultDepositAllocationWeight() reverted on ${parametersRegistryAddress}; continuing without pre-check`,
    );
  }
  let role = id('MANAGE_ALLOCATION_WEIGHTS_ROLE');
  try {
    role = await parametersRegistryReadonly.MANAGE_ALLOCATION_WEIGHTS_ROLE();
  } catch (error) {
    logger.warn(
      `MANAGE_ALLOCATION_WEIGHTS_ROLE() reverted on ${parametersRegistryAddress}; fallback to keccak role hash`,
    );
  }
  try {
    const hasRole = await parametersRegistryReadonly.hasRole(role, wallet.address);
    logger.log('MANAGE_ALLOCATION_WEIGHTS_ROLE for wallet', wallet.address, hasRole);
  } catch (error) {
    logger.warn(`hasRole() reverted on ${parametersRegistryAddress}; skipping role read check`);
  }

  await authorizedCall(parametersRegistry, 'setDefaultDepositAllocationWeight', [weight]);
  try {
    const after = await parametersRegistryReadonly.defaultDepositAllocationWeight();
    if (after !== weight) {
      throw new Error(
        `Failed to set defaultDepositAllocationWeight: expected ${weight.toString()}, got ${after.toString()} (before ${before?.toString() ?? 'n/a'})`,
      );
    }
    logger.log(
      'Default deposit allocation weight set to',
      weight,
      'on',
      parametersRegistryAddress,
      '(before',
      before ?? 'n/a',
      ')',
    );
    return;
  } catch (error) {
    logger.warn(
      `defaultDepositAllocationWeight() still reverts on ${parametersRegistryAddress}; set tx was sent without post-check`,
    );
  }
  logger.log('setDefaultDepositAllocationWeight tx submitted on', parametersRegistryAddress, 'value', weight);
};

const listExistingOperatorIds = async (): Promise<bigint[]> => {
  const total = await cmv2ModuleContract.getNodeOperatorsCount();
  const ids: bigint[] = [];

  for (let i = 0n; i < total; i++) {
    const operator = (await cmv2ModuleContract.getNodeOperator(i)).toObject();
    if (operator.managerAddress !== ZeroAddress) ids.push(i);
  }

  return ids;
};

const updateDepositableValidatorsCount = async (operatorIds: bigint[]) => {
  if (operatorIds.length === 0) {
    logger.warn('No existing operators found for updateDepositableValidatorsCount');
    return;
  }

  for (const operatorId of operatorIds) {
    await contractCallTxWithConfirm(cmv2ModuleContract, 'updateDepositableValidatorsCount', [operatorId]);
    logger.log('Updated depositable validators count for operator', operatorId.toString());
  }
};

const resolveCmv2StakingModuleId = async (): Promise<bigint | null> => {
  const cmv2ModuleAddress = (await cmv2ModuleContract.getAddress()).toLowerCase();
  const modulesCount = await stakingRouterContract.getStakingModulesCount();

  for (let moduleId = 1n; moduleId <= modulesCount; moduleId++) {
    const module = await stakingRouterContract.getStakingModule(moduleId);
    const moduleAddress = module.toObject().stakingModuleAddress.toLowerCase();
    if (moduleAddress === cmv2ModuleAddress) return moduleId;
  }

  return null;
};

const cmv2 = program
  .command('cmv2')
  .aliases(['curated-module-v2'])
  .description('interact with curated module v2 contract');
addAccessControlSubCommands(cmv2, cmv2ModuleContract);
addParsingCommands(cmv2, cmv2ModuleContract);
addLogsCommands(cmv2, cmv2ModuleContract);
addPauseUntilSubCommands(cmv2, cmv2ModuleContract);

cmv2
  .command('set-default-deposit-allocation-weight')
  .description('sets default deposit allocation weight on CMv2 ParametersRegistry')
  .argument('[weight]', 'default deposit allocation weight', '1')
  .option('-p, --parameters-registry <string>', 'parameters registry address override')
  .action(async (weight, options) => {
    const parametersRegistryAddress = resolveParametersRegistryAddress(options.parametersRegistry);
    await setDefaultDepositAllocationWeight(BigInt(weight), parametersRegistryAddress);
  });

cmv2
  .command('update-depositable-validators-count')
  .description('recomputes depositable validators count for CMv2 operators (all existing by default)')
  .option('-i, --operator-id <number>', 'node operator id override')
  .action(async (options) => {
    const operatorIds = options.operatorId != null ? [BigInt(options.operatorId)] : await listExistingOperatorIds();
    await updateDepositableValidatorsCount(operatorIds);
  });

cmv2
  .command('prepare-deposit')
  .description('sets allocation weight and recomputes depositable validators before staking-router deposit')
  .option('-w, --weight <number>', 'default deposit allocation weight', '1')
  .option('-p, --parameters-registry <string>', 'parameters registry address override')
  .option('--skip-weight', 'skip setDefaultDepositAllocationWeight step', false)
  .option('-i, --operator-id <number>', 'node operator id override')
  .option('-m, --module-id <number>', 'staking module id override')
  .option('--deposit', 'execute staking-router deposit after preparation', false)
  .action(async (options) => {
    if (!options.skipWeight) {
      const parametersRegistryAddress = resolveParametersRegistryAddress(options.parametersRegistry);
      await setDefaultDepositAllocationWeight(BigInt(options.weight), parametersRegistryAddress);
    } else {
      logger.warn('Skipping setDefaultDepositAllocationWeight step (--skip-weight)');
    }

    const operatorIds = options.operatorId != null ? [BigInt(options.operatorId)] : await listExistingOperatorIds();
    await updateDepositableValidatorsCount(operatorIds);

    const moduleId = options.moduleId != null ? BigInt(options.moduleId) : await resolveCmv2StakingModuleId();
    if (moduleId == null) {
      logger.warn('CMv2 module id not found in StakingRouter. Provide --module-id for deposit');
      return;
    }

    logger.log('CMv2 staking module id in StakingRouter', moduleId.toString());

    if (!options.deposit) {
      logger.log('Next step: ./run.sh sr deposit', moduleId.toString());
      return;
    }

    await contractCallTxWithConfirm(stakingRouterContract, 'deposit', [moduleId, '0x']);
  });

cmv2
  .command('grant-set-tree-role')
  .description('grants SET_TREE_ROLE on vetted gate')
  .argument('[account]', 'account to grant (defaults to wallet address)')
  .option('-a, --account <string>', 'account to grant (overrides argument)')
  .action(async (accountArg, options) => {
    const gateContract = getMerkleGateContract();
    if (!gateContract) {
      throw new Error('cmv2 curated/vetted gate address is not set; SET_TREE_ROLE is only for MerkleGate');
    }
    const account = options.account ?? accountArg ?? wallet.address;
    const role = await gateContract.SET_TREE_ROLE();
    await contractCallTxWithConfirm(gateContract, 'grantRole', [role, account]);
    logger.log('Granted SET_TREE_ROLE to', account, 'on', await gateContract.getAddress());
  });

cmv2
  .command('grant-set-tree-role-vote')
  .description('creates a vote to grant SET_TREE_ROLE on vetted gate')
  .argument('[account]', 'account to grant (defaults to wallet address)')
  .option('-g, --gate <string>', 'vetted gate address')
  .action(async (accountArg, options) => {
    if (cmv2VettedGateAddress === ZeroAddress && cmv2CuratedGateAddress === ZeroAddress && !options.gate) {
      throw new Error('cmv2 curated/vetted gate address is not set; provide --gate');
    }
    const account = options.account ?? accountArg ?? wallet.address;
    const gateContract = getMerkleGateContract();
    const gate = options.gate ?? gateContract?.target;
    if (!gate) throw new Error('No gate address available');
    const role = gateContract ? await gateContract.SET_TREE_ROLE() : await cmv2VettedGateContract.SET_TREE_ROLE();
    const iface = gateContract ? gateContract.interface : cmv2VettedGateContract.interface;

    const [, grantSetTreeRoleScript] = encodeFromAgent({
      to: gate,
      data: iface.encodeFunctionData('grantRole', [role, account]),
    });

    const calls: CallScriptAction[] = [grantSetTreeRoleScript];
    const description = `Grant SET_TREE_ROLE to ${account} on vetted gate ${gate}`;
    const voteEvmScript = encodeCallScript(calls);
    const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

    await forwardVoteFromTm(newVoteCalldata);
  });

cmv2
  .command('set-gate-tree-vote')
  .description('creates a vote to set vetted/curated gate tree root')
  .requiredOption('--root <bytes32>', 'merkle tree root')
  .option('-c, --cid <string>', 'tree cid', 'devnet-allowlist')
  .option('-g, --gate <string>', 'gate address (curated/vetted)')
  .action(async (options) => {
    const gateContract = getMerkleGateContract();
    const gate = options.gate ?? gateContract?.target;
    if (!gate) throw new Error('No gate address available');

    const iface = gateContract ? gateContract.interface : cmv2VettedGateContract.interface;
    const [, setTreeScript] = encodeFromAgent({
      to: gate,
      data: iface.encodeFunctionData('setTreeParams', [options.root, options.cid]),
    });

    const calls: CallScriptAction[] = [setTreeScript];
    const description = `Set gate tree root on ${gate} with cid ${options.cid}`;
    const voteEvmScript = encodeCallScript(calls);
    const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

    await forwardVoteFromTm(newVoteCalldata);
  });

cmv2
  .command('grant-manage-operator-groups-role')
  .description('grants MANAGE_OPERATOR_GROUPS_ROLE on MetaRegistry')
  .argument('[account]', 'account to grant (defaults to wallet address)')
  .option('-a, --account <string>', 'account to grant (overrides argument)')
  .option('-m, --meta-registry <string>', 'meta registry address override')
  .action(async (accountArg, options) => {
    const account = options.account ?? accountArg ?? wallet.address;
    const metaRegistryAddress =
      options.metaRegistry ??
      (await new Contract(await cmv2ModuleContract.getAddress(), cmv2ModuleMetaAbi, wallet).META_REGISTRY());
    if (!metaRegistryAddress || metaRegistryAddress === ZeroAddress) {
      throw new Error('MetaRegistry address not found on CMv2 module');
    }

    const role = id('MANAGE_OPERATOR_GROUPS_ROLE');
    const metaRegistry = new Contract(metaRegistryAddress, accessControlAbi, wallet);
    await contractCallTxWithConfirm(metaRegistry, 'grantRole', [role, account]);
    logger.log('Granted MANAGE_OPERATOR_GROUPS_ROLE to', account, 'on', metaRegistryAddress);
  });

cmv2
  .command('grant-manage-operator-groups-role-vote')
  .description('creates a vote to grant MANAGE_OPERATOR_GROUPS_ROLE on MetaRegistry')
  .argument('[account]', 'account to grant (defaults to wallet address)')
  .option('-a, --account <string>', 'account to grant (overrides argument)')
  .option('-m, --meta-registry <string>', 'meta registry address override')
  .action(async (accountArg, options) => {
    const account = options.account ?? accountArg ?? wallet.address;
    const metaRegistryAddress =
      options.metaRegistry ??
      (await new Contract(await cmv2ModuleContract.getAddress(), cmv2ModuleMetaAbi, wallet).META_REGISTRY());
    if (!metaRegistryAddress || metaRegistryAddress === ZeroAddress) {
      throw new Error('MetaRegistry address not found on CMv2 module');
    }

    const role = id('MANAGE_OPERATOR_GROUPS_ROLE');
    const iface = new Contract(metaRegistryAddress, accessControlAbi, wallet).interface;
    const [, grantRoleScript] = encodeFromAgent({
      to: metaRegistryAddress,
      data: iface.encodeFunctionData('grantRole', [role, account]),
    });

    const calls: CallScriptAction[] = [grantRoleScript];
    const description = `Grant MANAGE_OPERATOR_GROUPS_ROLE to ${account} on MetaRegistry ${metaRegistryAddress}`;
    const voteEvmScript = encodeCallScript(calls);
    const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

    await forwardVoteFromTm(newVoteCalldata);
  });

cmv2
  .command('update-initial-epoch-vote')
  .description('creates a vote to update initial epoch on CMv2 hash consensus')
  .argument('<epoch>', 'initial epoch')
  .option('-h, --hash-consensus <string>', 'hash consensus address (defaults to CS_ORACLE_HASH_CONSENSUS_ADDRESS)')
  .action(async (epoch, options) => {
    const hashConsensusAddress =
      options.hashConsensus ?? process.env.CS_ORACLE_HASH_CONSENSUS_ADDRESS;
    if (!hashConsensusAddress) {
      throw new Error('Hash consensus address not provided; use --hash-consensus or set CS_ORACLE_HASH_CONSENSUS_ADDRESS');
    }

    const iface = new Interface(['function updateInitialEpoch(uint256)']);
    const [, updateInitialEpochScript] = encodeFromAgent({
      to: hashConsensusAddress,
      data: iface.encodeFunctionData('updateInitialEpoch', [BigInt(epoch)]),
    });

    const calls: CallScriptAction[] = [updateInitialEpochScript];
    const description = `Update initial epoch to ${epoch} on hash consensus ${hashConsensusAddress}`;
    const voteEvmScript = encodeCallScript(calls);
    const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

    await forwardVoteFromTm(newVoteCalldata);
  });

cmv2
  .command('update-operator-group')
  .description('creates or updates MetaRegistry group for a CMv2 operator')
  .argument('<operator-id>', 'node operator id')
  .option('-m, --meta-registry <string>', 'meta registry address override')
  .action(async (operatorId, options) => {
    const nodeOperatorId = BigInt(operatorId);
    const metaRegistryAddress =
      options.metaRegistry ??
      (await new Contract(await cmv2ModuleContract.getAddress(), cmv2ModuleMetaAbi, wallet).META_REGISTRY());
    if (!metaRegistryAddress || metaRegistryAddress === ZeroAddress) {
      throw new Error('MetaRegistry address not found on CMv2 module');
    }

    const metaRegistry = new Contract(metaRegistryAddress, metaRegistryAbi, wallet);
    const groupId = await metaRegistry.NO_GROUP_ID();
    const subNodeOperators = [{ nodeOperatorId, share: 10000n }];

    await contractCallTxWithConfirm(metaRegistry, 'createOrUpdateOperatorGroup', [
      groupId,
      { subNodeOperators, externalOperators: [] },
    ]);
    logger.log('MetaRegistry group updated for operator', operatorId, 'on', metaRegistryAddress);
  });

cmv2
  .command('allow-self')
  .description('sets vetted gate tree root to wallet leaf (empty proof)')
  .option('-c, --tree-cid <string>', 'tree cid', 'devnet-single')
  .action(async (options) => {
    const gateContract = getMerkleGateContract();
    if (!gateContract) {
      throw new Error('cmv2 curated/vetted gate address is not set; allow-self only works for MerkleGate');
    }
    const { treeCid } = options;
    const leaf = await gateContract.hashLeaf(wallet.address);
    await contractCallTxWithConfirm(gateContract, 'setTreeParams', [leaf, treeCid]);
    logger.log('Gate tree set for', wallet.address, 'cid', treeCid);
  });

cmv2
  .command('operators')
  .description('returns operators count')
  .action(async () => {
    const total = await cmv2ModuleContract.getNodeOperatorsCount();
    logger.log('Total', Number(total));
  });

cmv2
  .command('operator')
  .description('returns operator')
  .argument('<operator-id>', 'operator id')
  .action(async (operatorId) => {
    const operator = await cmv2ModuleContract.getNodeOperator(operatorId);
    logger.log('Operator', operator.toObject());
  });

cmv2
  .command('operator-summary')
  .description('returns operator summary')
  .argument('<operator-id>', 'operator id')
  .action(async (operatorId) => {
    const summary = await cmv2ModuleContract.getNodeOperatorSummary(operatorId);
    logger.log('Operator summary', summary.toObject());
  });

cmv2
  .command('add-operator-eth')
  .description('adds node operator')
  .option('-k, --keys-count <number>', 'keys count', '1')
  .option('-p, --public-keys <string>', 'public keys')
  .option('-s, --signatures <string>', 'signatures')
  .option('-n, --name <string>', 'operator display name')
  .option('-d, --description <string>', 'operator description', '')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .option('-f, --proof-file <string>', 'merkle proof json file')
  .action(async (options) => {
    const {
      keysCount,
      publicKeys,
      signatures,
      name,
      description,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
      proofFile,
    } = options;

    const curveId = await cmv2AccountingContract.DEFAULT_BOND_CURVE_ID();
    const value = await cmv2AccountingContract['getBondAmountByKeysCount(uint256,uint256)'](keysCount, curveId);

    const proof = loadProof(proofFile);
    const beforeCount = await cmv2ModuleContract.getNodeOperatorsCount();

    if (cmv2CuratedGateAddress !== ZeroAddress) {
      const operatorName = name ?? `cmv2-${wallet.address.slice(0, 6)}`;
      const predictedId = await cmv2CuratedGateContract.createNodeOperator.staticCall(
        operatorName,
        description ?? '',
        managerAddress,
        rewardAddress,
        proof,
      );
      await contractCallTxWithConfirm(cmv2CuratedGateContract, 'createNodeOperator', [
        operatorName,
        description ?? '',
        managerAddress,
        rewardAddress,
        proof,
      ]);

      await ensureMetaRegistryGroup(predictedId);

      const bondValue = await cmv2AccountingContract.getRequiredBondForNextKeys(predictedId, keysCount);
      await contractCallTxWithConfirm(cmv2ModuleContract, 'addValidatorKeysETH(address,uint256,uint256,bytes,bytes)', [
        wallet.address,
        predictedId,
        keysCount,
        publicKeys,
        signatures,
        { value: bondValue },
      ]);
      return;
    }

    if (cmv2VettedGateAddress !== ZeroAddress) {
      await contractCallTxWithConfirm(cmv2VettedGateContract, 'addNodeOperatorETH', [
        keysCount,
        publicKeys,
        signatures,
        [managerAddress, rewardAddress, !!extendedManagerPermissions],
        proof,
        referrer,
        { value },
      ]);
    } else if (cmv2PermissionlessGateAddress !== ZeroAddress) {
      await contractCallTxWithConfirm(cmv2PermissionlessGateContract, 'addNodeOperatorETH', [
        keysCount,
        publicKeys,
        signatures,
        [managerAddress, rewardAddress, !!extendedManagerPermissions],
        referrer,
        { value },
      ]);
    } else {
      throw new Error('cmv2 gate address not configured (no vettedGate or permissionlessGate)');
    }

    const afterCount = await cmv2ModuleContract.getNodeOperatorsCount();
    if (afterCount > beforeCount) {
      await ensureMetaRegistryGroup(afterCount - 1n);
    } else {
      logger.warn('Node operators count did not increase; skipping MetaRegistry group update');
    }
  });

cmv2
  .command('add-operator-with-keys-from-file')
  .description('adds node operator with keys from file')
  .argument('<file-path>', 'file path')
  .option('-n, --name <string>', 'operator display name')
  .option('-d, --description <string>', 'operator description', '')
  .option('-i, --operator-id <number>', 'existing operator id (skip create)')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-e, --extended-manager-permissions', 'extended manager permissions', false)
  .option('-r, --referrer <string>', 'referrer', ZeroAddress)
  .option('-f, --proof-file <string>', 'merkle proof json file')
  .action(async (filePath, options) => {
    const {
      name,
      description,
      operatorId: operatorIdOption,
      managerAddress,
      rewardAddress,
      extendedManagerPermissions,
      referrer,
      proofFile,
    } = options;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const depositData: DepositData[] = require(filePath);
    await supplementAndVerifyDepositDataArray(depositData);

    const curveId = await cmv2AccountingContract.DEFAULT_BOND_CURVE_ID();
    const keysCount = depositData.length;
    const value = await cmv2AccountingContract['getBondAmountByKeysCount(uint256,uint256)'](keysCount, curveId);

    const publicKeys = joinHex(depositData.map(({ pubkey }) => pubkey));
    const signatures = joinHex(depositData.map(({ signature }) => signature));

    const proof = loadProof(proofFile);
    const beforeCount = await cmv2ModuleContract.getNodeOperatorsCount();

    if (cmv2CuratedGateAddress !== ZeroAddress) {
      let operatorId: bigint | null = operatorIdOption ? BigInt(operatorIdOption) : null;
      if (operatorId === null) {
        const operatorName = name ?? basename(filePath, extname(filePath));
        operatorId = await cmv2CuratedGateContract.createNodeOperator.staticCall(
          operatorName,
          description ?? '',
          managerAddress,
          rewardAddress,
          proof,
        );
        await contractCallTxWithConfirm(cmv2CuratedGateContract, 'createNodeOperator', [
          operatorName,
          description ?? '',
          managerAddress,
          rewardAddress,
          proof,
        ]);

        await ensureMetaRegistryGroup(operatorId as bigint);
      }

      if (operatorId === null) {
        throw new Error('operatorId is required when createNodeOperator is skipped');
      }

      const bondValue = await cmv2AccountingContract.getRequiredBondForNextKeys(operatorId, keysCount);
      await contractCallTxWithConfirm(cmv2ModuleContract, 'addValidatorKeysETH(address,uint256,uint256,bytes,bytes)', [
        wallet.address,
        operatorId,
        keysCount,
        publicKeys,
        signatures,
        { value: bondValue },
      ]);
      return;
    }

    if (cmv2VettedGateAddress !== ZeroAddress) {
      await contractCallTxWithConfirm(cmv2VettedGateContract, 'addNodeOperatorETH', [
        keysCount,
        publicKeys,
        signatures,
        [managerAddress, rewardAddress, !!extendedManagerPermissions],
        proof,
        referrer,
        { value },
      ]);
    } else if (cmv2PermissionlessGateAddress !== ZeroAddress) {
      await contractCallTxWithConfirm(cmv2PermissionlessGateContract, 'addNodeOperatorETH', [
        keysCount,
        publicKeys,
        signatures,
        [managerAddress, rewardAddress, !!extendedManagerPermissions],
        referrer,
        { value },
      ]);
    } else {
      throw new Error('cmv2 gate address not configured (no vettedGate or permissionlessGate)');
    }

    const afterCount = await cmv2ModuleContract.getNodeOperatorsCount();
    if (afterCount > beforeCount) {
      await ensureMetaRegistryGroup(afterCount - 1n);
    } else {
      logger.warn('Node operators count did not increase; skipping MetaRegistry group update');
    }
  });

cmv2
  .command('add-keys-from-file-eth')
  .description('adds signing keys from deposit data file')
  .argument('<operator-id>', 'node operator id')
  .argument('<file-path>', 'file path')
  .action(async (operatorId, filePath) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const depositData: DepositData[] = require(filePath);
    await supplementAndVerifyDepositDataArray(depositData);

    const keysCount = depositData.length;
    const value = await cmv2AccountingContract.getRequiredBondForNextKeys(operatorId, keysCount);

    const publicKeys = joinHex(depositData.map(({ pubkey }) => pubkey));
    const signatures = joinHex(depositData.map(({ signature }) => signature));

    await contractCallTxWithConfirm(cmv2ModuleContract, 'addValidatorKeysETH(address,uint256,uint256,bytes,bytes)', [
      wallet.address,
      operatorId,
      keysCount,
      publicKeys,
      signatures,
      { value },
    ]);
  });

cmv2
  .command('change-reward-address')
  .description('change reward address')
  .option('-i, --operator-id <number>', 'node operator id')
  .option('-a, --reward-address <string>', 'new reward address')
  .action(async (options) => {
    const { operatorId, rewardAddress } = options;

    await contractCallTxWithConfirm(cmv2ModuleContract, 'changeNodeOperatorRewardAddress', [operatorId, rewardAddress]);
  });

cmv2
  .command('keys')
  .description('returns signing keys')
  .argument('<operator-id>', 'operator id')
  .argument('[from-index]', 'from index')
  .argument('[count]', 'keys count')
  .action(async (operatorId, fromIndex, count) => {
    if (fromIndex == null && count == null) {
      const total = await cmv2ModuleContract.getNodeOperator(operatorId);

      fromIndex = 0;
      count = total.totalAddedKeys;
    }

    const [pubkeys, signatures] = await cmv2ModuleContract.getSigningKeysWithSignatures(
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
