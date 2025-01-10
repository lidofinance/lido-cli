import { program } from '@command';
import { logger } from './logger';

export const isNonInteractive = () => {
  const nonInteractive = program.getOptionValue('nonInteractive') == true;

  if (nonInteractive) {
    logger.warn('Non-interactive mode enabled, skipping confirmation prompts');
  }

  return nonInteractive;
};
