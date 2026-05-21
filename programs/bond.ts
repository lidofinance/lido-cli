import { program } from '@command';
import { cmv2AccountingContract, csAccountingContract } from '@contracts';
import { wallet } from '@providers';
import { contractCallTxWithConfirm, logger } from '@utils';
import { buildStETHPermit, buildWstETHPermit, loadProof } from './common/staking-modules';
import { DEFAULT_IPFS_GATEWAY, fetchRewardsLookup } from './common/rewards-tree';
import accountingAbi from 'abi/csm/Accounting.json';
import { Command } from 'commander';
import Table from 'cli-table3';
import { BaseContract, Contract, parseEther } from 'ethers';

type BondModule = 'csm' | 'cmv2';
type BondToken = 'eth' | 'steth' | 'wsteth';
type ClaimToken = 'steth' | 'wsteth' | 'unsteth';
type BondContext = { module: BondModule; accounting: Contract };

const bond = program.command('bond').description('interact with CSM/CMv2 bond accounting');

const withModuleOption = (command: Command) =>
  command.option('-M, --module <module>', 'staking module: csm or cmv2', 'csm');

const getBondContext = async (module: BondModule): Promise<BondContext> => {
  let baseContract: BaseContract;
  if (module === 'csm') {
    baseContract = csAccountingContract;
  } else if (module === 'cmv2') {
    baseContract = cmv2AccountingContract;
  } else {
    throw new Error(`Unsupported module "${module}". Use "csm" or "cmv2"`);
  }

  return {
    module,
    accounting: new Contract(await baseContract.getAddress(), accountingAbi, wallet),
  };
};

const getModuleLabel = (module: BondModule) => (module === 'csm' ? 'CSM' : 'CMv2');

const logModule = ({ module }: BondContext) => {
  logger.log('Module', getModuleLabel(module));
};

const asObject = (value: { toObject?: () => unknown }) => (value.toObject ? value.toObject() : value);

const formatCurve = (curve: { intervals: { toObject?: () => unknown }[] }) => ({
  intervals: curve.intervals.map(asObject),
});

const printInfoTable = (rows: Record<string, string | bigint>) => {
  const table = new Table({ head: ['Property', 'Value'] });
  Object.entries(rows).forEach(([property, value]) => table.push([property, value.toString()]));
  logger.log(table.toString());
};

const asBondModule = (module: string): BondModule => {
  if (module === 'csm' || module === 'cmv2') return module;
  throw new Error(`Unsupported module "${module}". Use "csm" or "cmv2"`);
};

const asBondToken = (token: string): BondToken => {
  if (token === 'eth' || token === 'steth' || token === 'wsteth') return token;
  throw new Error(`Unsupported token "${token}". Use "eth", "steth", or "wsteth"`);
};

const asClaimToken = (token: string): ClaimToken => {
  if (token === 'steth' || token === 'wsteth' || token === 'unsteth') return token;
  throw new Error(`Unsupported token "${token}". Use "steth", "wsteth", or "unsteth"`);
};

const claimRewardsMethod = (token: ClaimToken) => {
  switch (token) {
    case 'steth':
      return 'claimRewardsStETH(uint256,uint256,uint256,bytes32[])';
    case 'wsteth':
      return 'claimRewardsWstETH(uint256,uint256,uint256,bytes32[])';
    case 'unsteth':
      return 'claimRewardsUnstETH(uint256,uint256,uint256,bytes32[])';
  }
};

const printBondInfo = async (context: BondContext, operatorId: string) => {
  const info = await context.accounting.getNodeOperatorBondInfo(operatorId);
  printInfoTable({
    Module: getModuleLabel(context.module),
    'Operator ID': operatorId,
    ...(asObject(info) as Record<string, bigint>),
  });
};

const getAddBondTx = async (accounting: Contract, token: BondToken, operatorId: string, amount: bigint) => {
  switch (token) {
    case 'eth':
      return { method: 'depositETH(uint256)', args: [operatorId, { value: amount }] };
    case 'steth':
      return {
        method: 'depositStETH(uint256,uint256,(uint256,uint256,uint8,bytes32,bytes32))',
        args: [operatorId, amount, await buildStETHPermit(accounting, amount)],
      };
    case 'wsteth':
      return {
        method: 'depositWstETH(uint256,uint256,(uint256,uint256,uint8,bytes32,bytes32))',
        args: [operatorId, amount, await buildWstETHPermit(accounting, amount)],
      };
  }
};

withModuleOption(
  bond
    .command('info')
    .description('returns all bond-related info for a node operator')
    .argument('<operator-id>', 'node operator id'),
).action(async (operatorId: string, options: { module: string }) => {
  const context = await getBondContext(asBondModule(options.module));
  await printBondInfo(context, operatorId);
});

withModuleOption(
  bond
    .command('curve')
    .description('returns bond curve for a node operator')
    .argument('<operator-id>', 'node operator id'),
).action(async (operatorId: string, options: { module: string }) => {
  const context = await getBondContext(asBondModule(options.module));
  logModule(context);
  const { accounting } = context;
  const [curveId, curve] = await Promise.all([
    accounting.getBondCurveId(operatorId),
    accounting.getBondCurve(operatorId),
  ]);
  logger.log('Bond curve id', curveId);
  logger.table(formatCurve(curve).intervals);
});

withModuleOption(
  bond
    .command('required-for-next-keys')
    .description('returns required bond for adding next keys')
    .argument('<operator-id>', 'node operator id')
    .argument('<keys-count>', 'additional keys count'),
).action(async (operatorId: string, keysCount: string, options: { module: string }) => {
  const context = await getBondContext(asBondModule(options.module));
  const { accounting } = context;
  const [stETH, wstETH] = await Promise.all([
    accounting.getRequiredBondForNextKeys(operatorId, keysCount),
    accounting.getRequiredBondForNextKeysWstETH(operatorId, keysCount),
  ]);
  printInfoTable({
    Module: getModuleLabel(context.module),
    'Operator ID': operatorId,
    'Additional keys': keysCount,
    'Required ETH/stETH': stETH,
    'Required wstETH': wstETH,
  });
});

withModuleOption(
  bond
    .command('add')
    .description('adds bond from caller to a node operator')
    .argument('<operator-id>', 'node operator id')
    .argument('<amount>', 'amount in ETH/stETH/wstETH units')
    .requiredOption('-t, --token <token>', 'bond token: eth, steth, or wsteth'),
).action(async (operatorId: string, amount: string, options: { module: string; token: string }) => {
  const context = await getBondContext(asBondModule(options.module));
  logModule(context);
  const { accounting } = context;
  const parsedAmount = parseEther(amount);
  const { method, args } = await getAddBondTx(accounting, asBondToken(options.token), operatorId, parsedAmount);
  const tx = await contractCallTxWithConfirm(accounting, method, args);

  if (tx) await printBondInfo(context, operatorId);
});

withModuleOption(
  bond
    .command('claim-rewards')
    .description('claims rewards and excess bond for a node operator')
    .argument('<operator-id>', 'node operator id')
    .argument('<amount>', 'amount to claim in stETH/wstETH/unstETH units')
    .requiredOption('-t, --token <token>', 'claim token: steth, wsteth, or unsteth')
    .option('-c, --cumulative-fee-shares <number>', 'cumulative fee shares from rewards tree', '0')
    .option('-f, --proof-file <string>', 'merkle proof JSON array file, e.g. ["0x..."]')
    .option('--fetch-tree', 'fetch the rewards tree from IPFS and resolve cumulative shares/proof for the operator')
    .option('--ipfs-gateway <url>', 'IPFS gateway base URL', process.env.IPFS_GATEWAY || DEFAULT_IPFS_GATEWAY),
).action(
  async (
    operatorId: string,
    amount: string,
    options: {
      module: string;
      token: string;
      cumulativeFeeShares: string;
      proofFile?: string;
      fetchTree?: boolean;
      ipfsGateway: string;
    },
  ) => {
    if (options.fetchTree && options.proofFile) {
      throw new Error('--fetch-tree and --proof-file are mutually exclusive');
    }

    const context = await getBondContext(asBondModule(options.module));
    logModule(context);
    const { accounting } = context;

    let cumulativeFeeShares = BigInt(options.cumulativeFeeShares);
    let proof = loadProof(options.proofFile);

    if (options.fetchTree) {
      const lookup = await fetchRewardsLookup(accounting, operatorId, options.ipfsGateway);
      cumulativeFeeShares = lookup.cumulativeFeeShares;
      proof = lookup.proof;
      logger.log('Cumulative fee shares from tree', cumulativeFeeShares.toString());
      logger.log('Proof entries', proof.length);
    }

    const tx = await contractCallTxWithConfirm(accounting, claimRewardsMethod(asClaimToken(options.token)), [
      operatorId,
      parseEther(amount),
      cumulativeFeeShares,
      proof,
    ]);

    if (tx) await printBondInfo(context, operatorId);
  },
);
