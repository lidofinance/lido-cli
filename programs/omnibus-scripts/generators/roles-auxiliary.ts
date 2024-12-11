import prompts from 'prompts';
import { isAddress } from 'ethers';
import { logger } from '@utils';
import chalk from 'chalk';

const bold = chalk.white.bold;

export const promptRolesBeneficiary = async (initialAddress: string) => {
  const { address } = await prompts({
    type: 'text',
    name: 'address',
    validate: (value) => isAddress(value),
    initial: initialAddress,
    message: 'Enter roles beneficiary address',
  });

  return address;
};

export const confirmRoleGranting = async () => {
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Grant roles?',
    initial: true,
  });

  return confirm;
};

export const printRoles = async (contractName: string, roles: string[]) => {
  logger.log(bold(`${contractName} roles`));
  roles.map((role) => logger.log(`- ${role}`));
};
