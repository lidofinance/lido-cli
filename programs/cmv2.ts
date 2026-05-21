import { program } from '@command';
import {
  cmv2AccountingContract,
  cmv2EjectorContract,
  cmv2ModuleContract,
  cmv2MetaRegistryContract,
  cmv2CuratedGateAddress,
  lidoContract,
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
import { provider, wallet } from '@providers';
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

const resolveMetaRegistryContract = async (override?: string, blockTag?: number): Promise<Contract> => {
  const overrides = getCallOverrides(blockTag);
  const metaRegistryAddress = override ?? (await cmv2ModuleContract.META_REGISTRY(overrides));
  const metaRegistry = new Contract(metaRegistryAddress, cmv2MetaRegistryContract.interface, wallet);
  if (!metaRegistryAddress || metaRegistryAddress === ZeroAddress) {
    throw new Error('MetaRegistry address not found on CMv2 module');
  }
  return metaRegistry;
};

const EXTERNAL_OPERATOR_TYPE_NOR = 0n;

const parseUInt = (rawValue: string): bigint => {
  if (!/^\d+$/.test(rawValue)) throw new Error(`Expected unsigned integer, got: ${rawValue}`);
  return BigInt(rawValue);
};

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

type DepositAllocationBaseRow = {
  operatorId: bigint;
  groupId: bigint;
  name: string;
  weight: bigint;
  moduleCurrent: bigint;
  externalCurrent: bigint;
  current: bigint;
  depositable: bigint;
};

type DepositAllocationRow = DepositAllocationBaseRow & {
  allocationTarget: bigint | null;
  receives: bigint;
  unallocated: bigint;
};

type DepositAllocationOptions = {
  requestedDeposits: bigint;
  blockTag?: number;
  receivesByOperatorId?: Map<string, bigint>;
  allocated?: bigint;
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

const WEIGHT_BASE = 100_000n;
const formatWeight = (raw: string): string => {
  const value = parseUInt(raw);
  const whole = value / WEIGHT_BASE;
  const fractional = value % WEIGHT_BASE;
  if (fractional === 0n) return `${whole.toString()}.0`;

  const fractionalString = fractional.toString().padStart(5, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fractionalString}`;
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

const getCallOverrides = (blockTag?: number) => (blockTag == null ? {} : { blockTag });

const listExistingOperatorIds = async (blockTag?: number): Promise<bigint[]> => {
  const overrides = getCallOverrides(blockTag);
  const total = await cmv2ModuleContract.getNodeOperatorsCount(overrides);
  const ids: bigint[] = [];

  for (let i = 0n; i < total; i++) {
    const operator = (await cmv2ModuleContract.getNodeOperator(i, overrides)).toObject();
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

const formatSigned = (value: bigint): string => (value > 0n ? `+${value.toString()}` : value.toString());

const formatReceives = (value: bigint): string => (value > 0n ? chalk.green.bold(`+${value.toString()}`) : '0');

const formatMaybeWarningZero = (value: bigint): string => (value === 0n ? chalk.yellow('0') : value.toString());

const formatUnallocated = (value: bigint): string =>
  value > 0n ? chalk.yellow(value.toString()) : chalk.green(value.toString());

const formatCurrent = ({ moduleCurrent, externalCurrent }: DepositAllocationBaseRow): string =>
  externalCurrent > 0n
    ? `${moduleCurrent.toString()} ${chalk.gray(`(+${externalCurrent.toString()} ext)`)}`
    : moduleCurrent.toString();

const formatGap = (value: bigint): string => {
  if (value > 0n) return chalk.green(formatSigned(value));
  if (value < 0n) return chalk.yellow(value.toString());
  return '0';
};

const formatAllocationTarget = (value: bigint | null): string => (value == null ? chalk.gray('-') : value.toString());

const formatAllocationGap = (value: bigint | null): string => (value == null ? chalk.gray('-') : formatGap(value));

const getAllocationGap = ({
  allocationTarget,
  current,
}: Pick<DepositAllocationRow, 'allocationTarget' | 'current'>): bigint | null =>
  allocationTarget == null ? null : allocationTarget - current;

const divRoundUp = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator === 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
};

const compareBigIntAsc = (left: bigint, right: bigint): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const compareBigIntDesc = (left: bigint, right: bigint): number => compareBigIntAsc(right, left);

const getOperatorName = async (metaRegistry: Contract, operatorId: bigint, blockTag?: number): Promise<string> => {
  try {
    const overrides = getCallOverrides(blockTag);
    const metadata = await metaRegistry.getOperatorMetadata(operatorId, overrides);
    return metadata.toObject().name || `Operator ${operatorId.toString()}`;
  } catch {
    return `Operator ${operatorId.toString()}`;
  }
};

const sumReceives = (receivesByOperatorId: Map<string, bigint>): bigint => {
  let total = 0n;
  receivesByOperatorId.forEach((value) => {
    total += value;
  });
  return total;
};

const getInitialDepositsRequestedByRouter = async (stakingModuleId: bigint, blockTag: number): Promise<bigint> => {
  const overrides = getCallOverrides(blockTag);
  const depositableEther = await lidoContract.getDepositableEther(overrides);

  return stakingRouterContract.getStakingModuleMaxDepositsCount(stakingModuleId, depositableEther, overrides);
};

const S_SCALE = 1n << 96n;

const computeInitialDepositAllocation = (
  baseRows: DepositAllocationBaseRow[],
  requestedDeposits: bigint,
): {
  allocated: bigint;
  allocationsByOperatorId: Map<string, bigint>;
  allocationTargetsByOperatorId: Map<string, bigint>;
} => {
  const allocationsByOperatorId = new Map<string, bigint>();
  const allocationTargetsByOperatorId = new Map<string, bigint>();
  if (requestedDeposits === 0n) return { allocated: 0n, allocationsByOperatorId, allocationTargetsByOperatorId };

  const eligibleRows = baseRows.filter(({ weight, depositable }) => weight > 0n && depositable > 0n);
  if (eligibleRows.length === 0) return { allocated: 0n, allocationsByOperatorId, allocationTargetsByOperatorId };

  const totalEligibleWeight = eligibleRows.reduce((total, { weight }) => total + weight, 0n);
  const totalEligibleCurrent = eligibleRows.reduce((total, { current }) => total + current, 0n);
  const allocationTargetTotal = totalEligibleCurrent + requestedDeposits;
  const candidates = eligibleRows.map((row, index) => {
    const shareX96 = (row.weight * S_SCALE) / totalEligibleWeight;
    const target = divRoundUp(shareX96 * allocationTargetTotal, S_SCALE);
    const imbalance = target > row.current ? target - row.current : 0n;

    allocationTargetsByOperatorId.set(row.operatorId.toString(), target);

    return { row, index, imbalance };
  });

  candidates.sort((left, right) => {
    const imbalanceDiff = compareBigIntDesc(left.imbalance, right.imbalance);
    if (imbalanceDiff !== 0) return imbalanceDiff;
    return left.index - right.index;
  });

  let remaining = requestedDeposits;
  for (const { row, imbalance } of candidates) {
    if (remaining === 0n) break;
    const possible = imbalance < row.depositable ? imbalance : row.depositable;
    if (possible === 0n) continue;

    const receives = possible < remaining ? possible : remaining;
    allocationsByOperatorId.set(row.operatorId.toString(), receives);
    remaining -= receives;
  }

  return {
    allocated: requestedDeposits - remaining,
    allocationsByOperatorId,
    allocationTargetsByOperatorId,
  };
};

const computeInitialDepositUnallocated = (
  baseRows: DepositAllocationBaseRow[],
  requestedDeposits: bigint,
  allocationTargetsByOperatorId: Map<string, bigint>,
  allocationsByOperatorId: Map<string, bigint>,
): Map<string, bigint> => {
  const unallocatedByOperatorId = new Map<string, bigint>();
  const totalAllocated = sumReceives(allocationsByOperatorId);
  let remainingUnallocated = requestedDeposits > totalAllocated ? requestedDeposits - totalAllocated : 0n;
  if (remainingUnallocated === 0n) return unallocatedByOperatorId;

  const candidates = baseRows
    .filter(({ weight, depositable }) => weight > 0n && depositable > 0n)
    .map((row, index) => {
      const operatorKey = row.operatorId.toString();
      const target = allocationTargetsByOperatorId.get(operatorKey) ?? 0n;
      const gap = target - row.current;
      const targetRoom = gap > 0n ? gap : 0n;
      const blockedByTarget = row.depositable > targetRoom ? row.depositable - targetRoom : 0n;
      return { row, index, operatorKey, gap, blockedByTarget };
    })
    .filter(({ blockedByTarget }) => blockedByTarget > 0n);

  candidates.sort((left, right) => {
    const gapDiff = compareBigIntAsc(left.gap, right.gap);
    if (gapDiff !== 0) return gapDiff;
    return left.index - right.index;
  });

  for (const { operatorKey, blockedByTarget } of candidates) {
    if (remainingUnallocated === 0n) break;

    const unallocated = blockedByTarget < remainingUnallocated ? blockedByTarget : remainingUnallocated;
    unallocatedByOperatorId.set(operatorKey, unallocated);
    remainingUnallocated -= unallocated;
  }

  return unallocatedByOperatorId;
};

const getDepositAllocationRows = async ({
  requestedDeposits,
  blockTag,
  receivesByOperatorId,
  allocated: knownAllocated,
}: DepositAllocationOptions): Promise<{ allocated: bigint; rows: DepositAllocationRow[] }> => {
  const metaRegistry = await resolveMetaRegistryContract(undefined, blockTag);
  const overrides = getCallOverrides(blockTag);
  const operatorIds = await listExistingOperatorIds(blockTag);

  const baseRows = await Promise.all(
    operatorIds.map(async (operatorId): Promise<DepositAllocationBaseRow> => {
      const [name, groupId, weightAndExternalStake, summary, operator] = await Promise.all([
        getOperatorName(metaRegistry, operatorId, blockTag),
        metaRegistry.getNodeOperatorGroupId(operatorId, overrides),
        cmv2ModuleContract.getNodeOperatorWeightAndExternalStake(operatorId, overrides) as Promise<[bigint, bigint]>,
        cmv2ModuleContract.getNodeOperatorSummary(operatorId, overrides),
        cmv2ModuleContract.getNodeOperator(operatorId, overrides),
      ]);
      const summaryObject = summary.toObject() as {
        depositableValidatorsCount: bigint;
      };
      const operatorObject = operator.toObject() as {
        totalDepositedKeys: bigint;
        totalWithdrawnKeys: bigint;
      };
      const moduleCurrent = operatorObject.totalDepositedKeys - operatorObject.totalWithdrawnKeys;
      const externalCurrent = weightAndExternalStake[1] / MAX_EFFECTIVE_BALANCE;

      return {
        operatorId,
        groupId,
        name,
        weight: weightAndExternalStake[0],
        moduleCurrent,
        externalCurrent,
        current: moduleCurrent + externalCurrent,
        depositable: summaryObject.depositableValidatorsCount,
      };
    }),
  );

  const mirroredAllocation = computeInitialDepositAllocation(baseRows, requestedDeposits);
  const allocationsByOperatorId = receivesByOperatorId ?? mirroredAllocation.allocationsByOperatorId;
  const allocated = receivesByOperatorId
    ? (knownAllocated ?? sumReceives(receivesByOperatorId))
    : mirroredAllocation.allocated;
  const unallocatedByOperatorId = computeInitialDepositUnallocated(
    baseRows,
    requestedDeposits,
    mirroredAllocation.allocationTargetsByOperatorId,
    allocationsByOperatorId,
  );

  const rows = baseRows
    .map((row): DepositAllocationRow => {
      const operatorKey = row.operatorId.toString();
      return {
        ...row,
        allocationTarget: mirroredAllocation.allocationTargetsByOperatorId.get(operatorKey) ?? null,
        receives: allocationsByOperatorId.get(operatorKey) ?? 0n,
        unallocated: unallocatedByOperatorId.get(operatorKey) ?? 0n,
      };
    })
    .filter(({ receives, unallocated }) => receives > 0n || unallocated > 0n);

  rows.sort((left, right) => {
    const leftGap = getAllocationGap(left);
    const rightGap = getAllocationGap(right);
    if (leftGap == null && rightGap == null) return Number(left.operatorId - right.operatorId);
    if (leftGap == null) return 1;
    if (rightGap == null) return -1;

    const gapDiff = compareBigIntDesc(leftGap, rightGap);
    if (gapDiff !== 0) return gapDiff;

    return compareBigIntAsc(left.operatorId, right.operatorId);
  });

  return { allocated, rows };
};

const toDepositAllocationTableRow = (row: DepositAllocationRow): string[] => {
  const { operatorId, groupId, name, weight, current, allocationTarget, depositable, receives, unallocated } = row;
  const gap = getAllocationGap({ current, allocationTarget });
  return [
    `${operatorId.toString()}/${groupId.toString()}`,
    name,
    formatWeight(weight.toString()),
    formatCurrent(row),
    formatAllocationTarget(allocationTarget),
    formatAllocationGap(gap),
    formatMaybeWarningZero(depositable),
    formatReceives(receives),
    formatUnallocated(unallocated),
  ];
};

const printDepositAllocationRows = (
  requestedDeposits: bigint,
  allocated: bigint,
  rows: DepositAllocationRow[],
  notes: string[] = [],
) => {
  const notAllocated = requestedDeposits - allocated;
  const table = new Table({
    head: ['Operator/Group', 'Name', 'Weight', 'Current', 'Target', 'Gap', 'Depositable', 'Allocated', 'Unallocated'],
    colAligns: ['right', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
    style: { head: ['white', 'bold'], compact: true },
  });

  rows.forEach((row) => {
    table.push(toDepositAllocationTableRow(row));
  });

  logger.log();
  if (notes.length > 0) {
    logger.log(chalk.yellow('Notes:'));
    notes.forEach((note) => logger.log(chalk.yellow(`- ${note}`)));
  }
  logger.log(
    'Requested:',
    requestedDeposits.toString(),
    '  Allocated:',
    allocated.toString(),
    '  Not allocated:',
    notAllocated > 0n ? chalk.yellow(notAllocated.toString()) : chalk.green(notAllocated.toString()),
  );
  logger.log(table.toString());
};

const DEPOSIT_SIZE = 32n * 10n ** 18n;
const MAX_EFFECTIVE_BALANCE = 2048n * 10n ** 18n;

const getDepositReceivesByOperatorFromTx = async (
  txHash: string,
): Promise<{ requestedDeposits: bigint; receivesByOperatorId: Map<string, bigint>; blockTag: number }> => {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error(`Transaction receipt not found: ${txHash}`);
  if (receipt.blockNumber <= 0) throw new Error(`Cannot determine pre-tx block for ${txHash}`);

  const cmv2ModuleAddress = (await cmv2ModuleContract.getAddress()).toLowerCase();
  const stakingRouterAddress = (await stakingRouterContract.getAddress()).toLowerCase();
  const preTxBlock = receipt.blockNumber - 1;
  const cmv2ModuleId = await resolveCmv2StakingModuleId(preTxBlock);
  const nextDepositedByOperatorId = new Map<string, bigint>();
  let depositedAmount = 0n;
  let hasCmv2RouterDeposit = false;

  for (const log of receipt.logs) {
    const address = log.address.toLowerCase();

    if (address === stakingRouterAddress) {
      try {
        const parsed = stakingRouterContract.interface.parseLog(log);
        if (parsed?.name === 'StakingRouterETHDeposited') {
          const args = parsed.args.toObject() as { stakingModuleId: bigint; amount: bigint };
          if (cmv2ModuleId != null && args.stakingModuleId === cmv2ModuleId) {
            depositedAmount += args.amount;
            hasCmv2RouterDeposit = true;
          }
        }
      } catch {
        // Ignore logs that do not belong to the staking router ABI.
      }
    }

    if (address === cmv2ModuleAddress) {
      try {
        const parsed = cmv2ModuleContract.interface.parseLog(log);
        if (parsed?.name === 'DepositedSigningKeysCountChanged') {
          const args = parsed.args.toObject() as { nodeOperatorId: bigint; depositedKeysCount: bigint };
          nextDepositedByOperatorId.set(args.nodeOperatorId.toString(), args.depositedKeysCount);
        }
      } catch {
        // Ignore logs that do not belong to the CMv2 ABI.
      }
    }
  }

  if (!hasCmv2RouterDeposit && nextDepositedByOperatorId.size === 0) {
    throw new Error(`No CMv2 initial deposit events found in transaction ${txHash}`);
  }
  if (!hasCmv2RouterDeposit) {
    throw new Error(`No CMv2 StakingRouterETHDeposited event found in transaction ${txHash}`);
  }
  if (depositedAmount % DEPOSIT_SIZE !== 0n) {
    throw new Error(`CMv2 router deposited non-validator-sized amount: ${depositedAmount.toString()} wei`);
  }

  const receivesByOperatorId = new Map<string, bigint>();
  const overrides = getCallOverrides(preTxBlock);
  const sameBlockDepositedByOperatorId = new Map<string, bigint>();
  if (receipt.index > 0) {
    const sameBlockLogs = await provider.getLogs({
      address: cmv2ModuleAddress,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    for (const log of sameBlockLogs) {
      if (log.transactionIndex >= receipt.index) continue;
      try {
        const parsed = cmv2ModuleContract.interface.parseLog(log);
        if (parsed?.name === 'DepositedSigningKeysCountChanged') {
          const args = parsed.args.toObject() as { nodeOperatorId: bigint; depositedKeysCount: bigint };
          sameBlockDepositedByOperatorId.set(args.nodeOperatorId.toString(), args.depositedKeysCount);
        }
      } catch {
        // Ignore logs that do not belong to the CMv2 ABI.
      }
    }
  }

  for (const [operatorId, nextDeposited] of nextDepositedByOperatorId.entries()) {
    const summary = await cmv2ModuleContract.getNodeOperatorSummary(operatorId, overrides);
    const { totalDepositedValidators } = summary.toObject() as { totalDepositedValidators: bigint };
    const previousDeposited = sameBlockDepositedByOperatorId.get(operatorId) ?? totalDepositedValidators;
    if (nextDeposited < previousDeposited) {
      throw new Error(
        `Negative deposited-key delta for operator ${operatorId}: previous ${previousDeposited.toString()}, receipt ${nextDeposited.toString()}`,
      );
    }
    receivesByOperatorId.set(operatorId, nextDeposited - previousDeposited);
  }

  const actualDeposits = depositedAmount / DEPOSIT_SIZE;
  const actualReceives = sumReceives(receivesByOperatorId);
  if (actualReceives !== actualDeposits) {
    throw new Error(
      `Receipt mismatch: router deposited ${actualDeposits.toString()} keys, CMv2 events account for ${actualReceives.toString()}`,
    );
  }

  return {
    requestedDeposits:
      cmv2ModuleId == null ? actualDeposits : await getInitialDepositsRequestedByRouter(cmv2ModuleId, preTxBlock),
    receivesByOperatorId,
    blockTag: preTxBlock,
  };
};

const resolveCmv2StakingModuleId = async (blockTag?: number): Promise<bigint | null> => {
  const cmv2ModuleAddress = (await cmv2ModuleContract.getAddress()).toLowerCase();
  const overrides = getCallOverrides(blockTag);
  const modulesCount = await stakingRouterContract.getStakingModulesCount(overrides);

  for (let moduleId = 1n; moduleId <= modulesCount; moduleId++) {
    const module = await stakingRouterContract.getStakingModule(moduleId, overrides);
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
  .command('deposits')
  .description('explains initial validator deposit allocation across CMv2 node operators')
  .argument('<count>', 'initial validator deposits count')
  .action(async (count) => {
    const requestedDeposits = parseUInt(count);
    const { allocated, rows } = await getDepositAllocationRows({ requestedDeposits });
    printDepositAllocationRows(requestedDeposits, allocated, rows, [
      'Estimated allocation; current = CMv2 deposited-minus-withdrawn validators + floor(external stake / 2048 ETH).',
      'Row Unallocated is inferred depositable capacity above this iteration target, not an onchain field.',
    ]);
  });

cmv2
  .command('deposits-tx')
  .description('explains initial validator deposit allocation from a past CMv2 deposit transaction')
  .argument('<tx-hash>', 'transaction hash')
  .action(async (txHash) => {
    const { requestedDeposits, receivesByOperatorId, blockTag } = await getDepositReceivesByOperatorFromTx(txHash);
    const { allocated, rows } = await getDepositAllocationRows({
      requestedDeposits,
      blockTag,
      receivesByOperatorId,
    });
    logger.log('Block:', blockTag, '(pre-tx snapshot)');
    printDepositAllocationRows(requestedDeposits, allocated, rows, [
      'Requested/Target use the parent-block snapshot; Receives comes from receipt events with earlier same-block CMv2 deposits as baseline.',
      'Current = CMv2 deposited-minus-withdrawn validators + floor(external stake / 2048 ETH).',
      'Row Unallocated is inferred depositable capacity above this iteration target, not an onchain field.',
    ]);
  });

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
    } catch {
      logger.warn(`MANAGE_KEYS_LIMIT_ROLE() reverted on ${parametersRegistryAddress}; fallback to keccak role hash`);
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
    } catch {
      logger.warn(`defaultKeysLimit() reverted on ${parametersRegistryAddress}; continuing without pre-check`);
    }

    let role = id('MANAGE_KEYS_LIMIT_ROLE');
    try {
      role = await parametersRegistryReadonly.MANAGE_KEYS_LIMIT_ROLE();
    } catch {
      logger.warn(`MANAGE_KEYS_LIMIT_ROLE() reverted on ${parametersRegistryAddress}; fallback to keccak role hash`);
    }
    try {
      const hasRole = await parametersRegistryReadonly.hasRole(role, wallet.address);
      logger.log('MANAGE_KEYS_LIMIT_ROLE for wallet', wallet.address, hasRole);
    } catch {
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
    } catch {
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
