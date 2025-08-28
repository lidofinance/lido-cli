import { program } from '@command';
import { agentForward, encodeFromAgent, votingNewVote } from '@scripts';
import {
  CallScriptActionWithDescription,
  encodeCallScript,
  forwardVoteFromTm,
  splitAddresses,
  logger,
  compareContractCalls,
  authorizedCall,
} from '@utils';
import chalk from 'chalk';
import {
  encodeScriptsAO,
  encodeScriptsDSM,
  encodeScriptsLidoResumeIfStopped,
  encodeScriptsRoles,
  encodeScriptsVEBO,
  encodeScriptsWQResumeIfPaused,
  joinVotingDesc,
  DEFAULT_DEVNET_CONFIG,
} from './omnibus-scripts/generators';
import { getLocatorContract, getProxyContract, locatorContract } from '@contracts';
import { getCreateAddress } from 'ethers';
import { wallet } from '@providers';
import { findDeploymentTransaction } from 'utils';

const devnet = program.command('devnet').description('scripts for devnet');

const head = chalk.blue.bold;
const bold = chalk.white.bold;

devnet
  .command('setup')
  .option('-l, --staking-limit <number>', 'staking limit in eth', String(DEFAULT_DEVNET_CONFIG.STAKING_LIMIT))
  .option('-m, --oracles-members <string>', 'VEBO and AO members separated by comma', '')
  .option('-q, --oracles-quorum <number>', 'VEBO and AO members quorum, should be > 50%', '1')
  .option('-e, --oracles-initial-epoch <number>', 'initial epoch for VEBO and AO')
  .option('-g, --dsm-guardians <string>', 'DSM guardians separated by comma', '')
  .option('-d, --dsm-quorum <number>', 'DSM guardians quorum', '1')
  .option('-b, --roles-beneficiary <string>', 'roles beneficiary', DEFAULT_DEVNET_CONFIG.ROLES_BENEFICIARY)
  .action(async (options) => {
    // Lido
    logger.log(head('Lido'));
    const stakingLimit = Number(options.stakingLimit);
    console.log('>>>>>>>>> 1');
    const lidoResumeScripts = await encodeScriptsLidoResumeIfStopped(stakingLimit);
    logger.log();

    // Withdrawal Queue
    logger.log(head('Withdrawal Queue'));
    const wqResumeScripts = await encodeScriptsWQResumeIfPaused();
    logger.log();

    // Oracles
    logger.log(head('Oracles'));

    const oraclesInitialEpoch = options.oraclesInitialEpoch ? Number(options.oraclesInitialEpoch) : undefined;
    const oraclesMembers = splitAddresses(options.oraclesMembers);
    const oraclesQuorum = Number(options.oraclesQuorum);

    /**/ logger.log(bold('VEBO'));
    /**/ const veboScripts = await encodeScriptsVEBO(oraclesMembers, oraclesQuorum, oraclesInitialEpoch);
    /**/ logger.log();

    /**/ logger.log(bold('AO'));
    /**/ const aoScripts = await encodeScriptsAO(oraclesMembers, oraclesQuorum, oraclesInitialEpoch);
    /**/ logger.log();

    // DSM
    logger.log(head('DSM'));
    const guardians = splitAddresses(options.dsmGuardians);
    const dsmQuorum = Number(options.dsmQuorum);
    const dsmScripts = await encodeScriptsDSM(guardians, dsmQuorum);
    logger.log();

    // Roles
    logger.log(head('Roles'));
    const rolesBeneficiary = options.rolesBeneficiary;
    const rolesScripts = await encodeScriptsRoles(rolesBeneficiary);
    logger.log();

    // Voting calls
    const forwardedLidoResumeScripts = lidoResumeScripts.map((call) => {
      const [, agentCall] = encodeFromAgent(call);
      return agentCall;
    });

    const votingCalls: CallScriptActionWithDescription[] = [
      ...forwardedLidoResumeScripts,
      ...wqResumeScripts,
      ...veboScripts,
      ...aoScripts,
      ...dsmScripts,
      ...rolesScripts,
    ];

    // Voting description
    const description = joinVotingDesc(votingCalls);
    logger.log(head('Voting description:'));
    logger.log(description);
    logger.log();

    // Voting start
    const voteEvmScript = encodeCallScript(votingCalls);
    const [newVoteCalldata] = votingNewVote(voteEvmScript, description);
    console.log('>>>> vs2');
    await forwardVoteFromTm(newVoteCalldata);
  });

devnet
  .command('replace-dsm-with-eoa')
  .argument('<eoa>', 'EOA address')
  .action(async (eoa) => {
    console.log('>>>> rdwe 1');
    const getProxyAddress = async () => await locatorContract.getAddress();
    console.log('>>>> rdwe 2');
    const locatorProxyContract = getProxyContract(getProxyAddress);
    console.log('>>>> rdwe 3');
    const curLocatorImplementationAddress = await locatorProxyContract.proxy__getImplementation({
      gasLimit: 16_000_000,
    });

    console.log('>>>> rdwe 4');
    const currentDSMAddress = await locatorContract.depositSecurityModule({
      gasLimit: 16_000_000,
    });
    console.log('>>>> rdwe 5');
    const currentDSMAddressBytes = currentDSMAddress.slice(2).toLowerCase();
    const eoaBytes = eoa.slice(2).toLowerCase();

    if (eoaBytes.length !== 40) {
      logger.error('Invalid EOA address');
      return;
    }

    const currentLocatorImplementationDeploymentTx = await findDeploymentTransaction(curLocatorImplementationAddress);
    console.log('>>>> rdwe 7');
    const newLocatorDeploymentData = currentLocatorImplementationDeploymentTx.data.replaceAll(
      currentDSMAddressBytes,
      eoaBytes,
    );

    const newLocatorDeployTx = {
      data: newLocatorDeploymentData,
      gasLimit: 16_000_000,
    };

    const txResponse = await wallet.sendTransaction(newLocatorDeployTx);
    logger.log('New Locator deployment tx hash:', txResponse.hash);

    await txResponse.wait();

    const newLocatorImplementationAddress = getCreateAddress(txResponse);
    logger.log('New Locator implementation address:', newLocatorImplementationAddress);

    logger.log('Locator implementations diff');

    const curLocatorImplementationContract = getLocatorContract(curLocatorImplementationAddress);
    console.log('>>>> rdwe 8');
    const newLocatorImplementationContract = getLocatorContract(newLocatorImplementationAddress);
    console.log('>>>> rdwe 9');

    await compareContractCalls(
      [curLocatorImplementationContract, newLocatorImplementationContract],
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

    await authorizedCall(locatorProxyContract, 'proxy__upgradeTo', [newLocatorImplementationAddress]);
  });
