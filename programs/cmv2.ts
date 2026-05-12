import { program } from '@command';
import {
  cmv2AccountingContract,
  cmv2EjectorContract,
  cmv2ModuleContract,
  cmv2MetaRegistryContract,
  cmv2CuratedGateAddress,
  stakingRouterContract,
  withdrawalVaultContract,
} from '@contracts';
import {
  addAccessControlSubCommands,
  addLogsCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
  addValidatorKeysETH,
  createCuratedNodeOperator,
  loadProof,
  removeNodeOperatorKeys,
} from './common';
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
import { Contract, Interface, ZeroAddress, formatEther, getBytes, id, solidityPacked } from 'ethers';
import Table from 'cli-table3';
import chalk from 'chalk';
import { getNodeOperatorsMap } from './staking-module';

const parseKeyIndices = (input: string): bigint[] =>
  input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => BigInt(s));
import curatedGateAbi from 'abi/csm/CuratedGate.json';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const requireCuratedGate = (gate?: string): string => {
  const address = gate ?? cmv2CuratedGateAddress;
  if (!address || address === ZeroAddress) {
    throw new Error('Curated gate address not provided; pass --gate or configure cmv2.curatedGate.address');
  }
  return address;
};

const getCuratedGateContract = (gate?: string): Contract =>
  new Contract(requireCuratedGate(gate), curatedGateAbi, wallet);

const parametersRegistryAbi = [
  'function MANAGE_ALLOCATION_WEIGHTS_ROLE() view returns (bytes32)',
  'function MANAGE_KEYS_LIMIT_ROLE() view returns (bytes32)',
  'function defaultDepositAllocationWeight() view returns (uint256)',
  'function setDefaultDepositAllocationWeight(uint256)',
  'function defaultKeysLimit() view returns (uint256)',
  'function setDefaultKeysLimit(uint256)',
  'function setKeysLimit(uint256,uint256)',
  'function getKeysLimit(uint256) view returns (uint256)',
  'function grantRole(bytes32,address)',
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

const EXTERNAL_OPERATOR_TYPE_NOR = 0n;

const parseUInt = (rawValue: string): bigint => BigInt(rawValue);

type ParsedExternalOperatorData = {
  type: string;
  data: string;
  moduleId?: string;
  nodeOperatorId?: string;
  name?: string;
};

type FormattedOperatorGroup = {
  groupId: string;
  subNodeOperators: { nodeOperatorId: string; name: string; share: string; weight: string }[];
  externalOperators: ParsedExternalOperatorData[];
};

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

const parseExternalOperatorData = (data: string): ParsedExternalOperatorData => {
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

const getExternalOperatorName = async (
  operator: ParsedExternalOperatorData,
  operatorsByModule: Map<string, Promise<Record<number, { name: string }>>>,
): Promise<string | undefined> => {
  if (operator.type !== 'NOR' || operator.moduleId == null || operator.nodeOperatorId == null) return undefined;

  let operators = operatorsByModule.get(operator.moduleId);
  if (!operators) {
    operators = stakingRouterContract.getStakingModule(operator.moduleId).then((module) => {
      const { stakingModuleAddress } = module.toObject() as { stakingModuleAddress: string };
      return getNodeOperatorsMap(stakingModuleAddress);
    });
    operatorsByModule.set(operator.moduleId, operators);
  }

  return (await operators)[Number(operator.nodeOperatorId)]?.name ?? 'unknown';
};

const formatOperatorGroup = async (
  metaRegistry: Contract,
  groupId: bigint,
  operatorsByModule: Map<string, Promise<Record<number, { name: string }>>>,
): Promise<FormattedOperatorGroup> => {
  const group = (await metaRegistry.getOperatorGroup(groupId)).toObject() as {
    subNodeOperators: { nodeOperatorId: bigint; share: bigint }[];
    externalOperators: { data: string }[];
  };

  return {
    groupId: groupId.toString(),
    subNodeOperators: await Promise.all(
      group.subNodeOperators.map(async ({ nodeOperatorId, share }) => {
        const [metadata, weight] = await Promise.all([
          metaRegistry
            .getOperatorMetadata(nodeOperatorId)
            .then((result: { toObject: () => { name: string } }) => result.toObject()),
          metaRegistry.getNodeOperatorWeight(nodeOperatorId) as Promise<bigint>,
        ]);

        return {
          nodeOperatorId: nodeOperatorId.toString(),
          name: metadata.name,
          share: share.toString(),
          weight: weight.toString(),
        };
      }),
    ),
    externalOperators: await Promise.all(
      group.externalOperators.map(async ({ data }) => {
        const operator = parseExternalOperatorData(data);
        const name = await getExternalOperatorName(operator, operatorsByModule);
        return name == null ? operator : { ...operator, name };
      }),
    ),
  };
};

const formatShare = (basisPoints: string): string => `${Number(basisPoints) / 100}%`;

const WEIGHT_BASE = 100_000;
const formatWeight = (raw: string): string => {
  const value = Number(raw) / WEIGHT_BASE;
  const formatted = value.toString();
  return formatted.includes('.') ? formatted : `${formatted}.0`;
};

const formatExternalSource = ({ type, moduleId }: ParsedExternalOperatorData): string =>
  type === 'NOR' && moduleId != null ? `NOR (mod ${moduleId})` : type;

const printOperatorGroup = (group: FormattedOperatorGroup) => {
  const operatorCount = group.subNodeOperators.length + group.externalOperators.length;

  const table = new Table({
    head: ['Source', 'NO ID', 'Name', 'Share', 'Weight'],
    colAligns: ['left', 'right', 'left', 'right', 'right'],
    style: { head: ['white', 'bold'], compact: true },
  });

  group.subNodeOperators.forEach(({ nodeOperatorId, name, share, weight }) => {
    table.push(['CMv2', nodeOperatorId, name, formatShare(share), formatWeight(weight)]);
  });

  group.externalOperators.forEach((operator) => {
    table.push(
      [formatExternalSource(operator), operator.nodeOperatorId ?? '', operator.name ?? operator.data, '—', '—'].map(
        (cell) => chalk.gray(String(cell)),
      ),
    );
  });

  logger.log();
  logger.log(`Group ${group.groupId} (${operatorCount} operators)`);
  logger.log(table.toString());
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
  .description('grants SET_TREE_ROLE on the curated gate')
  .argument('[account]', 'account to grant (defaults to wallet address)')
  .option('-a, --account <string>', 'account to grant (overrides argument)')
  .option('-g, --gate <string>', 'curated gate address', cmv2CuratedGateAddress)
  .action(async (accountArg, options) => {
    const gateContract = getCuratedGateContract(options.gate);
    const account = options.account ?? accountArg ?? wallet.address;
    const role = await gateContract.SET_TREE_ROLE();
    await contractCallTxWithConfirm(gateContract, 'grantRole', [role, account]);
    logger.log('Granted SET_TREE_ROLE to', account, 'on', await gateContract.getAddress());
  });

cmv2
  .command('grant-set-tree-role-vote')
  .description('creates a vote to grant SET_TREE_ROLE on the curated gate')
  .argument('[account]', 'account to grant (defaults to wallet address)')
  .option('-a, --account <string>', 'account to grant (overrides argument)')
  .option('-g, --gate <string>', 'curated gate address', cmv2CuratedGateAddress)
  .action(async (accountArg, options) => {
    const gateContract = getCuratedGateContract(options.gate);
    const gate = await gateContract.getAddress();
    const account = options.account ?? accountArg ?? wallet.address;
    const role = await gateContract.SET_TREE_ROLE();

    const [, grantSetTreeRoleScript] = encodeFromAgent({
      to: gate,
      data: gateContract.interface.encodeFunctionData('grantRole', [role, account]),
    });

    const calls: CallScriptAction[] = [grantSetTreeRoleScript];
    const description = `Grant SET_TREE_ROLE to ${account} on curated gate ${gate}`;
    const voteEvmScript = encodeCallScript(calls);
    const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

    await forwardVoteFromTm(newVoteCalldata);
  });

cmv2
  .command('set-gate-tree-vote')
  .description('creates a vote to set curated gate tree root')
  .requiredOption('--root <bytes32>', 'merkle tree root')
  .option('-c, --cid <string>', 'tree cid', 'devnet-allowlist')
  .option('-g, --gate <string>', 'curated gate address', cmv2CuratedGateAddress)
  .action(async (options) => {
    const gateContract = getCuratedGateContract(options.gate);
    const gate = await gateContract.getAddress();

    const [, setTreeScript] = encodeFromAgent({
      to: gate,
      data: gateContract.interface.encodeFunctionData('setTreeParams', [options.root, options.cid]),
    });

    const calls: CallScriptAction[] = [setTreeScript];
    const description = `Set curated gate tree root on ${gate} with cid ${options.cid}`;
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
  .command('grant-manage-keys-limit-role-vote')
  .description('creates a vote to grant MANAGE_KEYS_LIMIT_ROLE on CMv2 ParametersRegistry')
  .argument('[account]', 'account to grant (defaults to wallet address)')
  .option('-a, --account <string>', 'account to grant (overrides argument)')
  .option('-p, --parameters-registry <string>', 'parameters registry address override')
  .action(async (accountArg, options) => {
    const account = options.account ?? accountArg ?? wallet.address;
    const parametersRegistryAddress = resolveParametersRegistryAddress(options.parametersRegistry);
    const readonlyRunner = wallet.provider ?? wallet;
    const parametersRegistryReadonly = new Contract(parametersRegistryAddress, parametersRegistryAbi, readonlyRunner);
    let role = id('MANAGE_KEYS_LIMIT_ROLE');
    try {
      role = await parametersRegistryReadonly.MANAGE_KEYS_LIMIT_ROLE();
    } catch (error) {
      logger.warn(
        `MANAGE_KEYS_LIMIT_ROLE() reverted on ${parametersRegistryAddress}; fallback to keccak role hash`,
      );
    }
    const iface = new Interface(['function grantRole(bytes32,address)']);
    const [, grantRoleScript] = encodeFromAgent({
      to: parametersRegistryAddress,
      data: iface.encodeFunctionData('grantRole', [role, account]),
    });

    const calls: CallScriptAction[] = [grantRoleScript];
    const description = `Grant MANAGE_KEYS_LIMIT_ROLE to ${account} on ParametersRegistry ${parametersRegistryAddress}`;
    const voteEvmScript = encodeCallScript(calls);
    const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

    await forwardVoteFromTm(newVoteCalldata);
  });

cmv2
  .command('set-default-keys-limit')
  .description('sets default keys limit on CMv2 ParametersRegistry (signer must hold MANAGE_KEYS_LIMIT_ROLE)')
  .argument('<limit>', 'default keys limit (decimal or 0x-hex; pass max for type(uint256).max)')
  .option('-p, --parameters-registry <string>', 'parameters registry address override')
  .action(async (limitArg: string, options) => {
    const parametersRegistryAddress = resolveParametersRegistryAddress(options.parametersRegistry);
    const limit = limitArg === 'max' ? (1n << 256n) - 1n : BigInt(limitArg);
    const parametersRegistry = new Contract(parametersRegistryAddress, parametersRegistryAbi, wallet);
    const readonlyRunner = wallet.provider ?? wallet;
    const parametersRegistryReadonly = new Contract(parametersRegistryAddress, parametersRegistryAbi, readonlyRunner);

    let before: bigint | null = null;
    try {
      before = await parametersRegistryReadonly.defaultKeysLimit();
    } catch (error) {
      logger.warn(
        `defaultKeysLimit() reverted on ${parametersRegistryAddress}; continuing without pre-check`,
      );
    }

    let role = id('MANAGE_KEYS_LIMIT_ROLE');
    try {
      role = await parametersRegistryReadonly.MANAGE_KEYS_LIMIT_ROLE();
    } catch (error) {
      logger.warn(
        `MANAGE_KEYS_LIMIT_ROLE() reverted on ${parametersRegistryAddress}; fallback to keccak role hash`,
      );
    }
    try {
      const hasRole = await parametersRegistryReadonly.hasRole(role, wallet.address);
      logger.log('MANAGE_KEYS_LIMIT_ROLE for wallet', wallet.address, hasRole);
    } catch (error) {
      logger.warn(`hasRole() reverted on ${parametersRegistryAddress}; skipping role read check`);
    }

    await authorizedCall(parametersRegistry, 'setDefaultKeysLimit', [limit]);
    try {
      const after = await parametersRegistryReadonly.defaultKeysLimit();
      if (after !== limit) {
        throw new Error(
          `Failed to set defaultKeysLimit: expected ${limit.toString()}, got ${after.toString()} (before ${before?.toString() ?? 'n/a'})`,
        );
      }
      logger.log(
        'Default keys limit set to',
        limit.toString(),
        'on',
        parametersRegistryAddress,
        '(before',
        before?.toString() ?? 'n/a',
        ')',
      );
      return;
    } catch (error) {
      logger.warn(
        `defaultKeysLimit() still reverts on ${parametersRegistryAddress}; set tx was sent without post-check`,
      );
    }
    logger.log('setDefaultKeysLimit tx submitted on', parametersRegistryAddress, 'value', limit.toString());
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
    const operatorsByModule = new Map<string, Promise<Record<number, { name: string }>>>();

    logger.log('MetaRegistry', metaRegistryAddress);

    if (options.groupId != null) {
      const groupId = parseUInt(options.groupId);
      const group = await formatOperatorGroup(metaRegistry, groupId, operatorsByModule);
      printOperatorGroup(group);
      return;
    }

    const noGroupId = await metaRegistry.NO_GROUP_ID();
    const groupsCount = await metaRegistry.getOperatorGroupsCount();
    const groups: FormattedOperatorGroup[] = [];

    for (let groupId = noGroupId + 1n; groupId < groupsCount; groupId++) {
      groups.push(await formatOperatorGroup(metaRegistry, groupId, operatorsByModule));
    }

    if (groups.length === 0) {
      logger.log('No configured operator groups');
      return;
    }

    groups.forEach(printOperatorGroup);
  });

cmv2
  .command('allow-self')
  .description('sets curated gate tree root to wallet leaf (empty proof)')
  .option('-c, --tree-cid <string>', 'tree cid (defaults to a unique devnet-single-<timestamp>)')
  .option('-g, --gate <string>', 'curated gate address', cmv2CuratedGateAddress)
  .action(async (options) => {
    const gateContract = getCuratedGateContract(options.gate);
    const leaf = await gateContract.hashLeaf(wallet.address);
    const treeCid = options.treeCid ?? `devnet-single-${Date.now()}`;
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
  .command('add-operator')
  .description('creates a CMv2 node operator through the curated gate')
  .option('-n, --name <string>', 'operator display name')
  .option('-d, --description <string>', 'operator description', '')
  .option('-m, --manager-address <string>', 'manager address', wallet.address)
  .option('-a, --reward-address <string>', 'reward address', wallet.address)
  .option('-f, --proof-file <string>', 'merkle proof JSON array file, e.g. ["0x..."]')
  .option('-g, --gate <address>', 'curated gate address', cmv2CuratedGateAddress)
  .action(async (options) => {
    const operatorId = await createCuratedNodeOperator({
      curatedGateContract: getCuratedGateContract(options.gate),
      name: options.name ?? `cmv2-${wallet.address.slice(0, 6)}`,
      description: options.description,
      managerAddress: options.managerAddress,
      rewardAddress: options.rewardAddress,
      proof: loadProof(options.proofFile),
    });

    if (operatorId !== null) logger.log('Created CMv2 node operator', operatorId.toString());
  });

cmv2
  .command('remove-keys')
  .alias('delete-keys')
  .description('removes signing keys')
  .argument('<operator-id>', 'node operator id')
  .argument('<start-index>', 'first key index to remove')
  .argument('<keys-count>', 'keys count')
  .action(async (operatorId, startIndex, keysCount) => {
    await removeNodeOperatorKeys(cmv2ModuleContract, operatorId, startIndex, keysCount);
  });

cmv2
  .command('add-keys')
  .description(
    'adds signing keys; uses existing operator bond by default and fails if short. Pass --topup-bond to send the missing bond as msg.value.',
  )
  .argument('<operator-id>', 'node operator id')
  .argument('<keys-count>', 'keys count')
  .argument('<public-keys>', 'public keys')
  .argument('<signatures>', 'signatures')
  .option('--topup-bond', 'send the missing bond as msg.value (default: do not top up)', false)
  .action(async (operatorId, keysCount, publicKeys, signatures, options) => {
    await addValidatorKeysETH(
      cmv2ModuleContract,
      cmv2AccountingContract,
      operatorId,
      keysCount,
      publicKeys,
      signatures,
      options.topupBond,
    );
  });

cmv2
  .command('add-keys-from-file')
  .description(
    'adds signing keys from a deposit-data file; uses existing operator bond by default and fails if short. Pass --topup-bond to send the missing bond as msg.value.',
  )
  .argument('<operator-id>', 'node operator id')
  .argument('<file-path>', 'file path')
  .option('--topup-bond', 'send the missing bond as msg.value (default: do not top up)', false)
  .action(async (operatorId, filePath, options) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const depositData: DepositData[] = require(filePath);
    await supplementAndVerifyDepositDataArray(depositData);

    await addValidatorKeysETH(
      cmv2ModuleContract,
      cmv2AccountingContract,
      operatorId,
      depositData.length,
      joinHex(depositData.map(({ pubkey }) => pubkey)),
      joinHex(depositData.map(({ signature }) => signature)),
      options.topupBond,
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
  .command('change-manager-address')
  .description('proposes a new manager address (must be confirmed by the new manager)')
  .option('-i, --operator-id <number>', 'node operator id')
  .option('-a, --manager-address <string>', 'new manager address')
  .action(async (options) => {
    const { operatorId, managerAddress } = options;

    await contractCallTxWithConfirm(cmv2ModuleContract, 'proposeNodeOperatorManagerAddressChange', [
      operatorId,
      managerAddress,
    ]);
  });

cmv2
  .command('confirm-manager-address')
  .description('confirms a proposed manager address change (must be sent by the new manager)')
  .option('-i, --operator-id <number>', 'node operator id')
  .action(async (options) => {
    const { operatorId } = options;

    await contractCallTxWithConfirm(cmv2ModuleContract, 'confirmNodeOperatorManagerAddressChange', [operatorId]);
  });

cmv2
  .command('voluntary-eject')
  .description('triggers voluntary full withdrawals for own validator keys (must be sent by the node operator owner)')
  .argument('<operator-id>', 'node operator id')
  .argument('<key-indices>', 'comma-separated key indices, e.g. "0,1,2"')
  .option('-r, --refund-recipient <address>', 'refund recipient for excess fee', wallet.address)
  .action(async (operatorId, keyIndicesInput, options) => {
    const keyIndices = parseKeyIndices(keyIndicesInput);
    if (keyIndices.length === 0) throw new Error('At least one key index is required');

    const feePerRequest: bigint = await withdrawalVaultContract.getWithdrawalRequestFee();
    const totalFee = feePerRequest * BigInt(keyIndices.length);

    logger.log('Operator id:', operatorId);
    logger.log('Key indices:', keyIndices.map(String).join(','));
    logger.log('Refund recipient:', options.refundRecipient);
    logger.log('Fee per request:', `${formatEther(feePerRequest)} ETH`);
    logger.log('Total fee:', `${formatEther(totalFee)} ETH`);

    await contractCallTxWithConfirm(cmv2EjectorContract, 'voluntaryEject', [
      operatorId,
      keyIndices,
      options.refundRecipient,
      { value: totalFee },
    ]);
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
