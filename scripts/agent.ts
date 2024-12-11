import { aragonAgentAddress, aragonAgentContract } from '@contracts';
import { CallScriptActionWithDescription, encodeCallScript } from '@utils';

export const agentForward = (votingData: string, desc: string = '') => {
  const call: CallScriptActionWithDescription = {
    to: aragonAgentAddress,
    data: aragonAgentContract.interface.encodeFunctionData('forward', [votingData]),
    desc,
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};
