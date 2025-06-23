import { dualGovernanceContract, dualGovernanceTimeLockContract, tmContract, votingContract } from '@contracts';
import { sleep } from './sleep';
import { contractCallTx, contractCallTxWithConfirm } from './call-tx';
import { logger } from './logger';
import progress, { SingleBar } from 'cli-progress';
import { provider } from '@providers';

export const forwardVoteFromTm = async (votingCalldata: string) => {
  const tx = await contractCallTxWithConfirm(tmContract, 'forward', [votingCalldata]);
  if (tx == null) return;
  logger.success('Vote started');

  await voteLastVoting();
};

export const voteLastVoting = async () => {
  const votesLength = await votingContract.votesLength();
  const lastVoteId = Number(votesLength) - 1;

  if (lastVoteId == -1) {
    logger.warn('No votes');
    return;
  }

  const lastVote = await votingContract.getVote(lastVoteId);

  if (lastVote.open == false) {
    logger.warn('Vote is not open');
    return;
  }

  if (Number(lastVote.phase) !== 0) {
    logger.warn('Wrong phase');
    return;
  }

  await voteFor(lastVoteId);
  await waitForEnd(lastVoteId);
  await executeVote(lastVoteId);
};

export const voteFor = async (voteId: number) => {
  const response = await contractCallTx(votingContract, 'vote', [voteId, true, false]);
  logger.success('Vote voted');
  return response;
};

export const voteAgainst = async (voteId: number) => {
  await contractCallTx(votingContract, 'vote', [voteId, false, false]);
  logger.success('Vote voted');
};

export const executeVote = async (voteId: number) => {
  const result = await contractCallTx(votingContract, 'executeVote', [voteId]);
  logger.success('Vote executed');
  return result;
};

export const executeVoteAndFindProposalId = async (voteId: number) => {
  const [tx, receipt] = await executeVote(voteId);

  logger.log(`Vote ${voteId} executed. Transaction: ${tx.hash}`);
  let proposalId;
  for (const log of receipt.logs) {
    try {
      const parsedLog = dualGovernanceContract.interface.parseLog(log);
      if (parsedLog && parsedLog.name && parsedLog.name.includes('Proposal') && parsedLog.args.proposalId) {
        proposalId = parsedLog.args.proposalId;
        break;
      }
    } catch {
      /* empty */
    }
  }

  if (!proposalId) throw new Error('ProposalId not found in transaction logs');

  return [tx, proposalId];
};

export const scheduleAndExecuteProposal = async (proposalId: number) => {
  const submitDelay = await dualGovernanceTimeLockContract.getAfterSubmitDelay();
  logger.log(`Waiting for submit delay: ${Number(submitDelay) + 1} seconds`);
  await sleep((Number(submitDelay) + 1) * 1000);

  await dualGovernanceContract.scheduleProposal(proposalId);
  logger.log('Proposal scheduled');

  // Step 4: Wait for schedule delay and execute
  const scheduleDelay = await dualGovernanceTimeLockContract.getAfterScheduleDelay();
  logger.log(`Waiting for schedule delay: ${Number(scheduleDelay) + 1} seconds`);
  await sleep((Number(scheduleDelay) + 1) * 1000);

  await dualGovernanceTimeLockContract.execute(proposalId);
  logger.log('Dual governance proposal executed successfully');
};

export const waitForDGProposal = async (
  proposalId: number,
  kind: 'submitted' | 'scheduled',
  progressBar?: SingleBar,
) => {
  const [[proposal], waitTime, block] = await Promise.all([
    dualGovernanceTimeLockContract.getProposal(proposalId) as unknown as [
      {
        id: bigint;
        executor: string;
        submittedAt: number;
        scheduledAt: number;
        // - `status`: The current status of the proposal. Possible values are:
        // - `1`: The proposal was submitted but not scheduled.
        // - `2`: The proposal was submitted and scheduled but not yet executed.
        // - `3`: The proposal was submitted, scheduled, and executed. This is the final state of the proposal lifecycle.
        // - `4`: The proposal was cancelled via `cancelAllNonExecutedProposals` and cannot be scheduled or executed anymore. This is the final state of the proposal lifecycle.
        status: number;
      },
      {
        target: string;
        value: bigint;
        payload: string;
      }[],
    ],
    kind === 'submitted'
      ? dualGovernanceTimeLockContract.getAfterSubmitDelay()
      : dualGovernanceTimeLockContract.getAfterScheduleDelay(),
    provider.getBlock('latest'),
  ]);

  if (!block) throw new Error('Can not get latest block');
  const timeEnd = Number(waitTime);
  const proposalStart = Number(kind === 'submitted' ? proposal.submittedAt : proposal.scheduledAt);
  const proposalEnd = proposalStart + Number(timeEnd);
  const secondsLeft = Math.max(0, (proposalEnd - block.timestamp) / 1000);
  const currentPosition = Math.min(block.timestamp - proposalStart, Number(timeEnd));
  if ((kind === 'submitted' ? Number(proposal.status) >= 2 : Number(proposal.status) >= 3) || secondsLeft <= 0) {
    progressBar?.update(currentPosition, { secondsLeft });
    progressBar?.stop();
    logger.log('');

    return;
  }

  if (progressBar) {
    progressBar.update(currentPosition, { secondsLeft });
  } else {
    progressBar = new progress.SingleBar(
      { format: `Proposal ${kind} #${proposalId} in progress |{bar}| {percentage}% | {secondsLeft}s left` },
      progress.Presets.shades_classic,
    );
    progressBar.start(Number(timeEnd), currentPosition, { secondsLeft });
  }

  await sleep(1_000);
  await waitForDGProposal(proposalId, kind, progressBar);
};

export const waitForEnd = async (voteId: number, progressBar?: SingleBar) => {
  const [vote, voteTime, block] = await Promise.all([
    votingContract.getVote(voteId),
    votingContract.voteTime(),
    provider.getBlock('latest'),
  ]);

  if (!block) throw new Error('Can not get latest block');

  const voteStart = Number(vote.startDate);
  const voteEnd = voteStart + Number(voteTime);
  const secondsLeft = Math.max(0, voteEnd - block.timestamp);
  const currentPosition = Math.min(block.timestamp - voteStart, Number(voteTime));

  if (!vote.open) {
    progressBar?.update(currentPosition, { secondsLeft });
    progressBar?.stop();
    logger.log('');

    return;
  }

  if (progressBar) {
    progressBar.update(currentPosition, { secondsLeft });
  } else {
    progressBar = new progress.SingleBar(
      { format: `Vote #${voteId} in progress |{bar}| {percentage}% | {secondsLeft}s left` },
      progress.Presets.shades_classic,
    );
    progressBar.start(Number(voteTime), currentPosition, { secondsLeft });
  }

  await sleep(10_000);
  await waitForEnd(voteId, progressBar);
};
