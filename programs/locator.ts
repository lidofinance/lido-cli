import { program } from '@command';
import { getLocatorContract, locatorContract } from '@contracts';
import { compareContractCalls } from '@utils';
import { addOssifiableProxyCommands, addParsingCommands } from './common';

const locator = program.command('locator').description('interact with locator contract');
addParsingCommands(locator, locatorContract);
addOssifiableProxyCommands(locator, locatorContract);

locator
  .command('core')
  .description('returns core components')
  .action(async () => {
    const components = await locatorContract.coreComponents();
    const [elRewardsVault, oracleReportSanityChecker, stakingRouter, treasury, withdrawalQueue, withdrawalVault] =
      components;

    console.log('components', {
      elRewardsVault,
      oracleReportSanityChecker,
      stakingRouter,
      treasury,
      withdrawalQueue,
      withdrawalVault,
    });
  });

locator
  .command('oracle-components')
  .description('returns oracle components')
  .action(async () => {
    const components = await locatorContract.oracleReportComponentsForLido();
    const [
      accountingOracle,
      elRewardsVault,
      oracleReportSanityChecker,
      burner,
      withdrawalQueue,
      withdrawalVault,
      postTokenRebaseReceiver,
    ] = components;

    console.log('components', {
      accountingOracle,
      elRewardsVault,
      oracleReportSanityChecker,
      burner,
      withdrawalQueue,
      withdrawalVault,
      postTokenRebaseReceiver,
    });
  });

locator
  .command('legacy-oracle')
  .description('returns legacy oracle')
  .action(async () => {
    const address = await locatorContract.legacyOracle();
    console.log('address', address);
  });

locator
  .command('report-sanity-checker')
  .description('returns report sanity checker')
  .action(async () => {
    const address = await locatorContract.oracleReportSanityChecker();
    console.log('address', address);
  });

locator
  .command('accounting-oracle')
  .description('returns accounting oracle')
  .action(async () => {
    const address = await locatorContract.accountingOracle();
    console.log('address', address);
  });

locator
  .command('exit-bus-oracle')
  .description('returns exit bus oracle')
  .action(async () => {
    const address = await locatorContract.validatorsExitBusOracle();
    console.log('address', address);
  });

locator
  .command('dsm')
  .description('returns deposit security module')
  .action(async () => {
    const address = await locatorContract.depositSecurityModule();
    console.log('address', address);
  });

locator
  .command('el-vault')
  .description('returns el rewards vault')
  .action(async () => {
    const address = await locatorContract.elRewardsVault();
    console.log('address', address);
  });

locator
  .command('lido')
  .description('returns lido')
  .action(async () => {
    const address = await locatorContract.lido();
    console.log('address', address);
  });

locator
  .command('post-token-rebase-receiver')
  .description('returns post token rebase receiver')
  .action(async () => {
    const address = await locatorContract.postTokenRebaseReceiver();
    console.log('address', address);
  });

locator
  .command('burner')
  .description('returns burner')
  .action(async () => {
    const address = await locatorContract.burner();
    console.log('address', address);
  });

locator
  .command('staking-router')
  .description('returns staking router')
  .action(async () => {
    const address = await locatorContract.stakingRouter();
    console.log('address', address);
  });

locator
  .command('treasury')
  .description('returns treasury')
  .action(async () => {
    const address = await locatorContract.treasury();
    console.log('address', address);
  });

locator
  .command('withdrawal-queue')
  .description('returns withdrawal queue')
  .action(async () => {
    const address = await locatorContract.withdrawalQueue();
    console.log('address', address);
  });

locator
  .command('withdrawal-vault')
  .description('returns withdrawal vault')
  .action(async () => {
    const address = await locatorContract.withdrawalVault();
    console.log('address', address);
  });

locator
  .command('oracle-config')
  .description('returns oracle config')
  .action(async () => {
    const address = await locatorContract.oracleDaemonConfig();
    console.log('address', address);
  });

locator
  .command('compare-implementations')
  .description('compares implementations')
  .argument('<first>', 'first implementation address')
  .argument('<second>', 'second implementation address')
  .action(async (firstAddress, secondAddress) => {
    const firstContract = getLocatorContract(firstAddress);
    const secondContract = getLocatorContract(secondAddress);

    await compareContractCalls(
      [firstContract, secondContract],
      [
        { method: 'accountingOracle' },
        { method: 'depositSecurityModule' },
        { method: 'elRewardsVault' },
        { method: 'legacyOracle' },
        { method: 'lido' },
        { method: 'oracleReportSanityChecker' },
        { method: 'postTokenRebaseReceiver' },
        { method: 'burner' },
        { method: 'stakingRouter' },
        { method: 'treasury' },
        { method: 'validatorsExitBusOracle' },
        { method: 'withdrawalQueue' },
        { method: 'withdrawalVault' },
        { method: 'oracleDaemonConfig' },
      ],
    );
  });
