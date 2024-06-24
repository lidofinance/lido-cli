import { program } from '@command';
import { checkTmCanForward, forwardVoteFromTm, logger, printTxToContract } from '@utils';
import { printVoteTxData, promptVoting } from './omnibus/';
import { tmContract } from '@contracts';

const omnibus = program.command('omnibus').description('preparing and launching batches of calls through voting');

omnibus
  .command('prepare')
  .description('prepare omnibus script')
  .action(async () => {
    const voteTxData = await promptVoting();
    if (!voteTxData) return;

    await printVoteTxData(voteTxData);
    await printTxToContract(tmContract, 'forward', [voteTxData.newVoteCalldata]);
  });

omnibus
  .command('run')
  .description('run omnibus script')
  .action(async () => {
    const canForward = await checkTmCanForward();
    if (!canForward) return;

    const voteTxData = await promptVoting();
    if (!voteTxData) return;

    await printVoteTxData(voteTxData);
    await forwardVoteFromTm(voteTxData.newVoteCalldata);
  });

omnibus
  .command('script')
  .argument('<script>', ' script to run')
  .action(async (script) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const scripts = require(`./omnibus-scripts`);

    if (typeof scripts[script] === 'function') {
      await scripts[script]();
    } else {
      logger.error(`Script ${script} not found`);
    }
  });
