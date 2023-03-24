import prompts from 'prompts';
import { TransactionResponse } from 'ethers';
import { wallet } from '@provider';
import chalk from 'chalk';

export const wrapTx = async (call: () => Promise<TransactionResponse>) => {
  const network = await wallet.provider.getNetwork();
  const networkName = chalk.yellow(network.name);
  const fromAddress = chalk.yellow(wallet.address);

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: `Tx will be sent to the ${networkName} network from ${fromAddress}. Continue?`,
    initial: true,
  });

  if (!confirm) return;

  const tx = await call();
  console.log('tx sent', chalk.green(tx.hash));

  console.log('waiting for tx to be mined...');
  const receipt = await tx.wait();

  console.log('tx result', receipt.toJSON());
};
