import { CallScriptAction, authorizedCallTest, encodeCallScript, logger } from '@utils';
import { aragonAgentAddress, votingAddress } from '@contracts';
import { Contract } from 'ethers';
import { agentForward } from './agent';
import chalk from 'chalk';
import prompts from 'prompts';

const printCallSuccess = (from: string) => {
  logger.success(`Successfully called from: ${chalk.bold(from)}, call added to the script\n`);
};

export const agentOrDirect = async (contract: Contract, method: string, args: unknown[] = []) => {
  const call: CallScriptAction = {
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData(method, args),
  };

  const errors = [];

  try {
    await authorizedCallTest(contract, method, args, aragonAgentAddress);
    printCallSuccess('agent');

    return encodeFromAgent(call);
  } catch (error) {
    errors.push(error);
  }

  try {
    await authorizedCallTest(contract, method, args, votingAddress);
    printCallSuccess('voting');

    return encodeFromVoting(call);
  } catch (error) {
    errors.push(error);
  }

  logger.error('\nCalls from voting and agent failed');

  const from = await promptFrom();

  if (from === 'agent') {
    return encodeFromAgent(call);
  }

  if (from === 'voting') {
    return encodeFromVoting(call);
  }

  logger.error(errors);
  throw new Error('Aborted');
};

export const promptFrom = async () => {
  const { from } = await prompts({
    type: 'select',
    name: 'from',
    message: 'What to do?',
    choices: [
      { title: chalk`Abort and show errors`, value: null },
      {
        title: chalk`Add as a direct call {red (only choose if you know what you are doing)}`,
        value: 'voting',
      },
      {
        title: chalk`Add as a forwarded call from agent {red (only choose if you know what you are doing)}`,
        value: 'agent',
      },
    ],
    initial: 0,
  });

  return from;
};

export const encodeFromAgent = (call: CallScriptAction) => {
  const encoded = encodeCallScript([call]);
  const [agentEncoded, agentCall] = agentForward(encoded);
  return [agentEncoded, agentCall] as const;
};

export const encodeFromVoting = (call: CallScriptAction) => {
  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};
