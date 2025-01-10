import prompts from 'prompts';
import chalk from 'chalk';
import { isNonInteractive } from './interactive';

export const confirmTx = async () => {
  if (isNonInteractive()) return true;

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Confirm sending transaction?',
    initial: true,
  });

  return confirm;
};

export const confirmOracleMemberTx = async () => {
  if (isNonInteractive()) return true;

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: chalk.red('This change will affect the operation of Ejector. Are all operators ready for this change?'),
    initial: false,
  });

  return confirm;
};
