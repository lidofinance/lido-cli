import { CallScriptActionWithDescription } from '@utils';

export const joinVotingDesc = (calls: CallScriptActionWithDescription[]) => {
  return calls.map(({ desc }, index) => `${index + 1}. ${desc}`).join('\n');
};
