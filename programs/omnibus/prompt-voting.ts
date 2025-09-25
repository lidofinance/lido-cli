import { encodeCallScript, isNonInteractive, logger, parseMethodCallToContract } from '@utils';
import { promptAmountOfCalls } from './prompt-amount';
import { printCallExample, printCallsSuccess, promptMethodCall } from './prompt-call';
import { OmnibusScript, promptOmnibusDescription } from './prompt-description';
import { agentOrDirect, encodeFromAgent, getCallScriptAction, votingNewVote } from '@scripts';
import { dualGovernanceAddress, dualGovernanceContract } from '@contracts';

export interface VoteTxData {
  voteEvmScript: string;
  newVoteCalldata: string;
  description: string;
}

export const promptVoting = async (): Promise<VoteTxData | void> => {
  if (isNonInteractive()) {
    throw new Error('Non-interactive mode is not supported for voting');
  }

  const amountOfCalls = await promptAmountOfCalls();
  const omnibusScripts: OmnibusScript[] = [];

  printCallExample();

  for (let i = 0; i < amountOfCalls; i++) {
    const methodCall = await promptMethodCall(i);

    if (methodCall) {
      try {
        const parsedCall = parseMethodCallToContract(methodCall);
        const { contract, method, args } = parsedCall;

        const [encoded, call] = await agentOrDirect(contract, method, args);
        omnibusScripts.push({ encoded, call, ...parsedCall });
      } catch (error) {
        logger.error(error);
        return;
      }
    } else {
      logger.warn('Empty call, aborting');
      return;
    }
  }

  printCallsSuccess();

  const description = await promptOmnibusDescription(omnibusScripts);

  const voteEvmScript = encodeCallScript(omnibusScripts.map(({ call }) => call));
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  return {
    voteEvmScript,
    newVoteCalldata,
    description,
  };
};

export const promptVotingDG = async (): Promise<VoteTxData | void> => {
  if (isNonInteractive()) {
    throw new Error('Non-interactive mode is not supported for voting');
  }

  const amountOfCalls = await promptAmountOfCalls();
  const omnibusScripts: OmnibusScript[] = [];

  printCallExample();

  for (let i = 0; i < amountOfCalls; i++) {
    const methodCall = await promptMethodCall(i);

    if (methodCall) {
      try {
        const parsedCall = parseMethodCallToContract(methodCall);
        const { contract, method, args } = parsedCall;

        const callScript = await getCallScriptAction(contract, method, args);
        const [encoded, callFromAgent] = await encodeFromAgent(callScript);

        omnibusScripts.push({ encoded, call: callFromAgent, ...parsedCall });
      } catch (error) {
        logger.error(error);
        return;
      }
    } else {
      logger.warn('Empty call, aborting');
      return;
    }
  }

  printCallsSuccess();

  const description = await promptOmnibusDescription(omnibusScripts);

  // dual governance proposal calls
  const dgExternalCalls = omnibusScripts.map(({ call }) => ({ target: call.to, value: 0, payload: call.data }));

  // empty metadata description
  const dgMetadata = '';

  // encode dual governance submitProposal call
  const dgCall = {
    to: dualGovernanceAddress,
    data: dualGovernanceContract.interface.encodeFunctionData('submitProposal', [dgExternalCalls, dgMetadata]),
  };

  const voteEvmScript = encodeCallScript([dgCall]);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  return {
    voteEvmScript,
    newVoteCalldata,
    description,
  };
};
