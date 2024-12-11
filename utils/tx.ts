import { confirmTx } from './confirm-tx';
import { printTx } from './print-tx';
import { logger } from './logger';
import { wallet } from '@providers';

export const txWithConfirmation = async (to: string | undefined | null, value: bigint, data: string) => {
  if (!wallet.provider) throw new Error('Provider is not available');

  await printTx(wallet.provider, wallet.address, to, value, data);

  const confirmed = await confirmTx();
  if (!confirmed) return null;

  const tx = await wallet.sendTransaction({
    from: wallet.address,
    data,
    value,
    to,
  });

  logger.success('Tx sent', tx.hash);

  logger.log('Waiting for tx to be mined...');
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error('Transaction receipt is not available');
  }

  return [tx, receipt] as const;
};
