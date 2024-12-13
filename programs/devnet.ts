import { program } from '@command';
import { votingNewVote } from '@scripts';
import { CallScriptActionWithDescription, encodeCallScript, forwardVoteFromTm, splitAddresses, logger } from '@utils';
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
    const votingCalls: CallScriptActionWithDescription[] = [
      ...lidoResumeScripts,
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
    await forwardVoteFromTm(newVoteCalldata);
  });
