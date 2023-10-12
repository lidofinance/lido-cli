import { program } from '@command';
import { getLocatorContract, locatorContract } from '@contracts';
import { compareContractCalls, logger } from '@utils';
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

    logger.log('Components', {
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

    logger.log('Components', {
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
  .command('all')
  .description('returns all addresses')
  .action(async () => {
    const [
      accountingOracle,
      elRewardsVault,
      oracleReportSanityChecker,
      burner,
      withdrawalQueue,
      withdrawalVault,
      postTokenRebaseReceiver,
    ] = await locatorContract.oracleReportComponentsForLido();

    const [
      legacyOracle,
      validatorsExitBusOracle,
      depositSecurityModule,
      lido,
      stakingRouter,
      treasury,
      oracleDaemonConfig,
    ] = await Promise.all([
      locatorContract.legacyOracle(),
      locatorContract.validatorsExitBusOracle(),
      locatorContract.depositSecurityModule(),
      locatorContract.lido(),
      locatorContract.stakingRouter(),
      locatorContract.treasury(),
      locatorContract.oracleDaemonConfig(),
    ]);

    logger.log('Components', {
      accountingOracle,
      elRewardsVault,
      oracleReportSanityChecker,
      burner,
      withdrawalQueue,
      withdrawalVault,
      postTokenRebaseReceiver,
      legacyOracle,
      validatorsExitBusOracle,
      depositSecurityModule,
      lido,
      stakingRouter,
      treasury,
      oracleDaemonConfig,
    });
  });

locator
  .command('legacy-oracle')
  .description('returns legacy oracle')
  .action(async () => {
    const address = await locatorContract.legacyOracle();
    logger.log('Address', address);
  });

locator
  .command('report-sanity-checker')
  .description('returns report sanity checker')
  .action(async () => {
    const address = await locatorContract.oracleReportSanityChecker();
    logger.log('Address', address);
  });

locator
  .command('accounting-oracle')
  .description('returns accounting oracle')
  .action(async () => {
    const address = await locatorContract.accountingOracle();
    logger.log('Address', address);
  });

locator
  .command('exit-bus-oracle')
  .description('returns exit bus oracle')
  .action(async () => {
    const address = await locatorContract.validatorsExitBusOracle();
    logger.log('Address', address);
  });

locator
  .command('dsm')
  .description('returns deposit security module')
  .action(async () => {
    const address = await locatorContract.depositSecurityModule();
    logger.log('Address', address);
  });

locator
  .command('el-vault')
  .description('returns el rewards vault')
  .action(async () => {
    const address = await locatorContract.elRewardsVault();
    logger.log('Address', address);
  });

locator
  .command('lido')
  .description('returns lido')
  .action(async () => {
    const address = await locatorContract.lido();
    logger.log('Address', address);
  });

locator
  .command('post-token-rebase-receiver')
  .description('returns post token rebase receiver')
  .action(async () => {
    const address = await locatorContract.postTokenRebaseReceiver();
    logger.log('Address', address);
  });

locator
  .command('burner')
  .description('returns burner')
  .action(async () => {
    const address = await locatorContract.burner();
    logger.log('Address', address);
  });

locator
  .command('staking-router')
  .description('returns staking router')
  .action(async () => {
    const address = await locatorContract.stakingRouter();
    logger.log('Address', address);
  });

locator
  .command('treasury')
  .description('returns treasury')
  .action(async () => {
    const address = await locatorContract.treasury();
    logger.log('Address', address);
  });

locator
  .command('withdrawal-queue')
  .description('returns withdrawal queue')
  .action(async () => {
    const address = await locatorContract.withdrawalQueue();
    logger.log('Address', address);
  });

locator
  .command('withdrawal-vault')
  .description('returns withdrawal vault')
  .action(async () => {
    const address = await locatorContract.withdrawalVault();
    logger.log('Address', address);
  });

locator
  .command('oracle-config')
  .description('returns oracle config')
  .action(async () => {
    const address = await locatorContract.oracleDaemonConfig();
    logger.log('Address', address);
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
