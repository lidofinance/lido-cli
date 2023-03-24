import { TransactionResponse } from 'ethers';

export const wrapTx = async (call: () => Promise<TransactionResponse>) => {
  const tx = await call();
  console.log('tx sent', tx.hash);

  console.log('waiting for tx to be mined...');
  const receipt = await tx.wait();

  console.log('tx result', receipt.toJSON());
};
