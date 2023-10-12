import { encodeCallScript, logger, parseMethodCallToContract } from '@utils';
import { promptAmountOfCalls } from './prompt-amount';
import { printCallExample, printCallsSuccess, promptMethodCall } from './prompt-call';
import { OmnibusScript, promptOmnibusDescription } from './prompt-description';
import { agentOrDirect, votingNewVote } from '@scripts';

export interface VoteTxData {
  voteEvmScript: string;
  newVoteCalldata: string;
  description: string;
}

export const promptVoting = async (): Promise<VoteTxData | void> => {
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
