import { logger } from '@utils';
import chalk from 'chalk';
import prompts from 'prompts';

const head = chalk.white.bold;
const title = chalk.gray;
const value = chalk.blue.bold;

export const printCallExample = () => {
  logger.log(head('\nEnter calls one by one'));
  logger.log(title(` Format:`), value('address signature [...args]'));
  logger.log(
    title(`Example:`),
    value(`0x595F64Ddc3856a3b5Ff4f4CC1d1fb4B46cFd2bAC 'setNodeOperatorStakingLimit(uint256,uint64)' 0 150`),
  );
  logger.log('');
};

export const printCallsSuccess = () => {
  logger.success('Filling the list of calls is completed\n');
};

export const promptMethodCall = async (index: number) => {
  const { methodCall } = await prompts({
    type: 'text',
    name: 'methodCall',
    message: `Enter call ${index + 1}`,
  });

  return methodCall;
};
