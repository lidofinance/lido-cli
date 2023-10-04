import chalk from 'chalk';
import prompts from 'prompts';

const title = chalk.gray;
const value = chalk.blue.bold;

export const confirmTx = async (network: string, from: string, to: string, call: string, data: string) => {
  console.log(title('chain:'), value(network));
  console.log(title(' from:'), value(from));
  console.log(title('   to:'), value(to));
  console.log(title(' call:'), value(call));
  console.log(title(' data:'), value(data));

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'confirm sending transaction?',
    initial: true,
  });

  return confirm;
};
