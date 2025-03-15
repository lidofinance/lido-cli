import { program } from '@command';
import { logger } from './logger';
import { envs } from '@configs';

export const isNonInteractive = () => {
  const nonInteractive = envs.LIDO_CLI_NON_INTERACTIVE ?? program.getOptionValue('nonInteractive') == true;

  if (nonInteractive) {
    logger.warn('Non-interactive mode enabled, skipping confirmation prompts');
  }

  return nonInteractive;
};
