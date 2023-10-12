import { writeFile, access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import prompts from 'prompts';
import { dirname } from 'path';
import { logger } from './logger';

const isFileExists = async (filePath: string) => {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const writeToFile = async (filePath: string, fileContent: string) => {
  const isExist = await isFileExists(filePath);

  if (isExist) {
    logger.warn(`File ${filePath} already exists`);

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to rewrite it?',
      initial: true,
    });

    if (!confirm) {
      logger.warn('File not saved');
      return;
    }
  }

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, fileContent);
    logger.success(`File saved to ${filePath}`);
  } catch (error) {
    logger.error('Failed to save file', error);
  }
};
