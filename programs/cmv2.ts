import { program } from '@command';
import {
  cmv2AccountingContract,
  cmv2ModuleContract,
  cmv2MetaRegistryContract,
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
import { Contract, Interface, ZeroAddress, getBytes, id, solidityPacked } from 'ethers';
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

const parametersRegistryAbi = [
  'function MANAGE_ALLOCATION_WEIGHTS_ROLE() view returns (bytes32)',
  'function defaultDepositAllocationWeight() view returns (uint256)',
  'function setDefaultDepositAllocationWeight(uint256)',
  'function hasRole(bytes32,address) view returns (bool)',
];

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
  } catch {
    logger.warn(
      `defaultDepositAllocationWeight() reverted on ${parametersRegistryAddress}; continuing without pre-check`,
    );
  }
  let role = id('MANAGE_ALLOCATION_WEIGHTS_ROLE');
  try {
    role = await parametersRegistryReadonly.MANAGE_ALLOCATION_WEIGHTS_ROLE();
  } catch {
    logger.warn(
      `MANAGE_ALLOCATION_WEIGHTS_ROLE() reverted on ${parametersRegistryAddress}; fallback to keccak role hash`,
    );
  }
  try {
    const hasRole = await parametersRegistryReadonly.hasRole(role, wallet.address);
    logger.log('MANAGE_ALLOCATION_WEIGHTS_ROLE for wallet', wallet.address, hasRole);
  } catch {
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
  } catch {
    logger.warn(
      `defaultDepositAllocationWeight() still reverts on ${parametersRegistryAddress}; set tx was sent without post-check`,
    );
  }
  logger.log('setDefaultDepositAllocationWeight tx submitted on', parametersRegistryAddress, 'value', weight);
};

const resolveMetaRegistryContract = async (override?: string): Promise<Contract> => {
  const metaRegistry = override
    ? new Contract(override, cmv2MetaRegistryContract.interface, wallet)
    : cmv2MetaRegistryContract;
  const metaRegistryAddress = await metaRegistry.getAddress();
  if (!metaRegistryAddress || metaRegistryAddress === ZeroAddress) {
    throw new Error('MetaRegistry address not found on CMv2 module');
  }
  return metaRegistry;
};

const addValidatorKeysETH = async (
  operatorId: string,
  keysCount: string | number,
  publicKeys: string,
  signatures: string,
  bond: boolean,
) => {
  const value = bond ? await cmv2AccountingContract.getRequiredBondForNextKeys(operatorId, keysCount) : 0n;

  await contractCallTxWithConfirm(cmv2ModuleContract, 'addValidatorKeysETH(address,uint256,uint256,bytes,bytes)', [
    wallet.address,
    operatorId,
    keysCount,
    publicKeys,
    signatures,
    { value },
  ]);
};

const EXTERNAL_OPERATOR_TYPE_NOR = 0n;

const parseUInt = (rawValue: string): bigint => BigInt(rawValue);

const parsePair = (entry: string): [string, string] => {
  const [left = '', right = ''] = entry.split(',').map((item: string) => item.trim());
  return [left, right];
};

const toSubNodeOperators = (entries: string[]): { nodeOperatorId: bigint; share: bigint }[] => {
  return entries.map((entry) => {
    const [nodeOperatorIdRaw, shareRaw] = parsePair(entry);
    const nodeOperatorId = parseUInt(nodeOperatorIdRaw);
    const share = parseUInt(shareRaw);

    return { nodeOperatorId, share };
  });
};

const toExternalOperators = (entries: string[]): { data: string }[] => {
  return entries.map((entry) => {
    const [moduleIdRaw, nodeOperatorIdRaw] = parsePair(entry);
    const moduleId = parseUInt(moduleIdRaw);
    const nodeOperatorId = parseUInt(nodeOperatorIdRaw);

    const data = solidityPacked(['uint8', 'uint8', 'uint64'], [EXTERNAL_OPERATOR_TYPE_NOR, moduleId, nodeOperatorId]);

    return { data };
  });
};

const parseExternalOperatorData = (data: string) => {
  try {
    const bytes = getBytes(data);
    if (bytes.length !== 10) {
      return { type: 'UNKNOWN', data };
    }

    const type = bytes[0];
    if (type !== Number(EXTERNAL_OPERATOR_TYPE_NOR)) {
      return { type: `UNKNOWN(${type})`, data };
    }

    const moduleId = bytes[1];
    let nodeOperatorId = 0n;
    for (let i = 2; i < 10; i++) {
      nodeOperatorId = (nodeOperatorId << 8n) + BigInt(bytes[i]);
    }

    return {
      type: 'NOR',
      moduleId: moduleId.toString(),
      nodeOperatorId: nodeOperatorId.toString(),
      data,
    };
  } catch {
    return { type: 'UNKNOWN', data };
  }
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
    const metaRegistry = await resolveMetaRegistryContract(options.metaRegistry);
    const metaRegistryAddress = await metaRegistry.getAddress();
    const role = id('MANAGE_OPERATOR_GROUPS_ROLE');
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
    const metaRegistry = await resolveMetaRegistryContract(options.metaRegistry);
    const metaRegistryAddress = await metaRegistry.getAddress();
    const role = id('MANAGE_OPERATOR_GROUPS_ROLE');
    const [, grantRoleScript] = encodeFromAgent({
      to: metaRegistryAddress,
      data: metaRegistry.interface.encodeFunctionData('grantRole', [role, account]),
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
    const hashConsensusAddress = options.hashConsensus ?? process.env.CS_ORACLE_HASH_CONSENSUS_ADDRESS;
    if (!hashConsensusAddress) {
      throw new Error(
        'Hash consensus address not provided; use --hash-consensus or set CS_ORACLE_HASH_CONSENSUS_ADDRESS',
      );
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
  .description('creates or updates MetaRegistry group')
  .requiredOption('--subs <entries...>', 'sub operators as nodeOperatorId,share (e.g. 12,7000 14,3000)')
  .option('--external <entries...>', 'external operators as moduleId,nodeOperatorId (e.g. 1,11 2,13)')
  .option('-g, --group-id <number>', 'operator group id to update (defaults to NO_GROUP_ID/create)')
  .option('-m, --meta-registry <string>', 'meta registry address override')
  .action(async (options) => {
    const subNodeOperators = toSubNodeOperators(options.subs);
    const externalOperators = toExternalOperators(options.external ?? []);

    const metaRegistry = await resolveMetaRegistryContract(options.metaRegistry);
    const groupId = options.groupId != null ? parseUInt(options.groupId) : await metaRegistry.NO_GROUP_ID();

    await contractCallTxWithConfirm(metaRegistry, 'createOrUpdateOperatorGroup', [
      groupId,
      { subNodeOperators, externalOperators },
    ]);
  });

cmv2
  .command('operator-groups')
  .description('lists configured MetaRegistry operator groups')
  .option('-g, --group-id <number>', 'single group id to show')
  .option('-m, --meta-registry <string>', 'meta registry address override')
  .action(async (options) => {
    const metaRegistry = await resolveMetaRegistryContract(options.metaRegistry);
    const metaRegistryAddress = await metaRegistry.getAddress();

    if (options.groupId != null) {
      const groupId = parseUInt(options.groupId);
      const group = (await metaRegistry.getOperatorGroup(groupId)).toObject() as {
        subNodeOperators: { nodeOperatorId: bigint; share: bigint }[];
        externalOperators: { data: string }[];
      };

      logger.log('MetaRegistry group', {
        metaRegistryAddress,
        groupId: groupId.toString(),
        subNodeOperators: group.subNodeOperators.map(({ nodeOperatorId, share }) => ({
          nodeOperatorId: nodeOperatorId.toString(),
          share: share.toString(),
        })),
        externalOperators: group.externalOperators.map(({ data }) => parseExternalOperatorData(data)),
      });
      return;
    }

    const noGroupId = await metaRegistry.NO_GROUP_ID();
    const groupsCount = await metaRegistry.getOperatorGroupsCount();
    const groups: {
      groupId: string;
      subNodeOperators: { nodeOperatorId: string; share: string }[];
      externalOperators: ReturnType<typeof parseExternalOperatorData>[];
    }[] = [];

    for (let groupId = noGroupId + 1n; groupId < groupsCount; groupId++) {
      const group = (await metaRegistry.getOperatorGroup(groupId)).toObject() as {
        subNodeOperators: { nodeOperatorId: bigint; share: bigint }[];
        externalOperators: { data: string }[];
      };

      groups.push({
        groupId: groupId.toString(),
        subNodeOperators: group.subNodeOperators.map(({ nodeOperatorId, share }) => ({
          nodeOperatorId: nodeOperatorId.toString(),
          share: share.toString(),
        })),
        externalOperators: group.externalOperators.map(({ data }) => parseExternalOperatorData(data)),
      });
    }

    if (groups.length === 0) {
      logger.log('No configured MetaRegistry groups on', metaRegistryAddress);
      return;
    }

    logger.log('Configured MetaRegistry groups on', metaRegistryAddress, groups);
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
  });

cmv2
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

cmv2
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
