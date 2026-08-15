import { dualGovernanceAddress, dualGovernanceContract, emergencyProtectedTimelockContract } from '@contracts';
import { contractCallTx } from './call-tx';
import { logger } from './logger';
import { provider } from '@providers';
import { waitWithProgressBar } from './progress-bar';
import { ContractTransactionReceipt } from 'ethers';
import { CallScriptAction, encodeCallScript } from './scripts';
import { forwardVoteFromTm } from './voting';
import { votingNewVote } from '@scripts';

export interface ProposalDetails {
  id: number;
  executor: string;
  submittedAt: number;
  scheduledAt: number;
  status: number;
}

export const dgScheduleAndExecuteProposal = async (proposalId: number) => {
  const proposalDetails = await emergencyProtectedTimelockContract.getProposalDetails(proposalId);

  if (proposalDetails.status == 0) {
    throw new Error('Proposal is not exist');
  }

  if (proposalDetails.status == 1) {
    logger.success('Proposal is submitted, trying to schedule...');
    await dgScheduleProposal(proposalId);
    await dgExecuteProposal(proposalId);
    return;
  }

  if (proposalDetails.status == 2) {
    logger.success('Proposal is scheduled, trying to execute...');
    await dgExecuteProposal(proposalId);
    return;
  }

  if (proposalDetails.status == 3) {
    throw new Error('Proposal is already executed');
  }

  if (proposalDetails.status == 4) {
    throw new Error('Proposal is canceled');
  }

  throw new Error('Unsupported proposal status');
};

export const dgScheduleProposal = async (proposalId: number) => {
  const proposalDetails = await emergencyProtectedTimelockContract.getProposalDetails(proposalId);

  const afterSubmitDelay = Number(await emergencyProtectedTimelockContract.getAfterSubmitDelay());
  const submittedAt = Number(proposalDetails.submittedAt);
  const canScheduleAt = submittedAt + afterSubmitDelay + 1;

  await waitWithProgressBar('Waiting after submit delay', async () => {
    const latestBlock = await provider.getBlock('latest');
    const latestTimestamp = Number(latestBlock?.timestamp);

    if (!latestBlock) throw new Error('Can not get latest block');

    return {
      total: afterSubmitDelay,
      currentPosition: Math.min(latestTimestamp - submittedAt, afterSubmitDelay),
      secondsLeft: Math.max(0, canScheduleAt - latestTimestamp),
    };
  });

  logger.log('Scheduling proposal...');
  await contractCallTx(dualGovernanceContract, 'scheduleProposal', [proposalDetails.id]);
  logger.success('Proposal scheduled');
};

export const dgExecuteProposal = async (proposalId: number) => {
  const proposalDetails = await emergencyProtectedTimelockContract.getProposalDetails(proposalId);

  const afterScheduleDelay = Number(await emergencyProtectedTimelockContract.getAfterScheduleDelay());
  const scheduledAt = Number(proposalDetails.scheduledAt);
  const canExecuteAt = scheduledAt + afterScheduleDelay + 1;

  await waitWithProgressBar('Waiting after schedule delay', async () => {
    const latestBlock = await provider.getBlock('latest');
    const latestTimestamp = Number(latestBlock?.timestamp);
    if (!latestBlock) throw new Error('Can not get latest block');

    return {
      total: afterScheduleDelay,
      currentPosition: Math.min(latestTimestamp - scheduledAt, afterScheduleDelay),
      secondsLeft: Math.max(0, canExecuteAt - latestTimestamp),
    };
  });

  logger.log('Executing proposal...');
  await contractCallTx(emergencyProtectedTimelockContract, 'execute', [proposalDetails.id]);
  logger.success('Proposal executed');
};

export const extractDgProposalId = async (receipt: ContractTransactionReceipt) => {
  for (const log of receipt.logs) {
    const parsedLog = dualGovernanceContract.interface.parseLog(log);
    if (parsedLog?.name === 'ProposalSubmitted') {
      const proposalId = parsedLog.args?.[1];
      return proposalId;
    }
  }

  return null;
};

/**
 * Drop-in DG-flavored replacement for forwardVoteFromTm in non-interactive omnibus scripts.
 * Takes the same CallScriptAction[] that would have been encoded into a direct Voting EVMScript,
 * wraps them as one DG submitProposal item, forwards via TM, then schedules+executes through DG.
 */
export const forwardVoteFromTmDG = async (calls: CallScriptAction[], description: string) => {
  const externalCalls = calls.map((call) => ({
    target: call.to,
    value: 0,
    payload: call.data,
  }));

  const dgCall: CallScriptAction = {
    to: dualGovernanceAddress,
    data: dualGovernanceContract.interface.encodeFunctionData('submitProposal', [externalCalls, '']),
  };

  const voteEvmScript = encodeCallScript([dgCall]);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  const result = await forwardVoteFromTm(newVoteCalldata);
  if (!result) {
    logger.warn('Vote submission aborted (forwardVoteFromTm returned null)');
    return;
  }

  const [, receipt] = result;
  const proposalId = await extractDgProposalId(receipt);
  if (proposalId == null) {
    logger.warn('DG proposalId not found in receipt — DG submitProposal did not emit ProposalSubmitted');
    return;
  }

  await dgScheduleAndExecuteProposal(Number(proposalId));
};
