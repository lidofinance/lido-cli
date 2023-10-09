import { aragonAgentAddress, aragonAgentContract } from '@contracts';
import { CallScriptAction, encodeCallScript } from '@utils';

export const agentForward = (votingData: string) => {
  const call: CallScriptAction = {
    to: aragonAgentAddress,
    data: aragonAgentContract.interface.encodeFunctionData('forward', [votingData]),
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};
