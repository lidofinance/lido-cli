import { CallScriptAction, ParsedMethodCall } from '@utils';
import prompts from 'prompts';

export interface OmnibusScript extends ParsedMethodCall {
  encoded: string;
  call: CallScriptAction;
}

export const getDefaultOmnibusDescription = (omnibusScripts: OmnibusScript[]) => {
  const callList = omnibusScripts
    .map(({ address, args, methodName }, index) => `${index + 1}) call ${methodName}(${args}) at ${address}`)
    .join('\n');

  return `omnibus: \n${callList}`;
};

export const promptOmnibusDescription = async (omnibusScripts: OmnibusScript[]) => {
  const defaultDescription = getDefaultOmnibusDescription(omnibusScripts);

  const { description } = await prompts({
    type: 'text',
    name: 'description',
    initial: defaultDescription,
    message: 'enter voting description (use \\n for new line): \n',
  });

  return (description ?? '').split('\\n').join('\n');
};
