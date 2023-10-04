import chalk from 'chalk';
import { writeFile, access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import prompts from 'prompts';
import { dirname } from 'path';

const isFileExists = async (filePath: string) => {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const warn = chalk.yellow;

export const writeToFile = async (filePath: string, fileContent: string) => {
  const isExist = await isFileExists(filePath);

  if (isExist) {
    console.log(warn(`file ${filePath} already exists`));

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'do you want to rewrite it?',
      initial: true,
    });

    if (!confirm) {
      console.log('file not saved');
      return;
    }
  }

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, fileContent);
    console.log('file saved to', filePath);
  } catch (error) {
    console.error(error);
  }
};
