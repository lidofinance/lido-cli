import { CallScriptAction, authorizedCallTest, encodeCallScript } from '@utils';
import { aragonAgentAddress, votingAddress } from '@contracts';
import { Contract } from 'ethers';
import { agentForward } from './agent';
import chalk from 'chalk';
import prompts from 'prompts';

const printCallSuccess = (from: string) => {
  console.log(chalk`{green successfully called from {bold ${from}}, added to the list}`);
  console.log('');
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

  console.log('');
  console.warn(chalk`{red calls from voting and agent failed}`);

  const from = await promptFrom();

  if (from === 'agent') {
    return encodeFromAgent(call);
  }

  if (from === 'voting') {
    return encodeFromVoting(call);
  }

  console.dir(errors, { depth: null });
  throw new Error('aborted');
};

export const promptFrom = async () => {
  const { from } = await prompts({
    type: 'select',
    name: 'from',
    message: 'what to do?',
    choices: [
      { title: chalk`abort and show errors`, value: null },
      {
        title: chalk`add as a direct call {red (only choose if you know what you are doing)}`,
        value: 'voting',
      },
      {
        title: chalk`add as a forwarded call from agent {red (only choose if you know what you are doing)}`,
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
