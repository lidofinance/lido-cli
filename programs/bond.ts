import { program } from '@command';
import { cmv2AccountingContract, csAccountingContract } from '@contracts';
import { wallet } from '@providers';
import { logger } from '@utils';
import accountingAbi from 'abi/csm/Accounting.json';
import { Command } from 'commander';
import Table from 'cli-table3';
import { BaseContract, Contract } from 'ethers';

type BondModule = 'csm' | 'cmv2';
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

withModuleOption(
  bond
    .command('info')
    .description('returns all bond-related info for a node operator')
    .argument('<operator-id>', 'node operator id'),
).action(async (operatorId: string, options: { module: string }) => {
  const context = await getBondContext(asBondModule(options.module));
  const { accounting } = context;
  const info = await accounting.getNodeOperatorBondInfo(operatorId);
  printInfoTable({
    Module: getModuleLabel(context.module),
    'Operator ID': operatorId,
    ...(asObject(info) as Record<string, bigint>),
  });
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
