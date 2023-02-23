import { formatEther, MaxUint256, toBeHex } from 'ethers';
import { program } from '@command';
import { withdrawalRequestContract } from '@contracts';
import {
  addAccessControlSubCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
} from './common';

const withdrawal = program.command('withdrawal-request').description('interact with withdrawal request contract');
addAccessControlSubCommands(withdrawal, withdrawalRequestContract);
addOssifiableProxyCommands(withdrawal, withdrawalRequestContract);
addParsingCommands(withdrawal, withdrawalRequestContract);
addPauseUntilSubCommands(withdrawal, withdrawalRequestContract);

withdrawal
  .command('request')
  .option('-a, --amount <string>', 'stETH amount')
  .action(async (options) => {
    const { amount } = options;
    const [requestId] = await withdrawalRequestContract.requestWithdrawals([amount]);
    console.log('request id', requestId);
  });

withdrawal
  .command('claim')
  .argument('<number>', 'request id')
  .action(async (requestId) => {
    await withdrawalRequestContract.claimWithdrawal(requestId);
    console.log('claimed');
  });

withdrawal.command('bunker').action(async () => {
  const isBunker = await withdrawalRequestContract.isBunkerModeActive();
  console.log('bunker', isBunker);
});

withdrawal.command('bunker-start').action(async () => {
  const timestamp = await withdrawalRequestContract.bunkerModeSinceTimestamp();
  if (timestamp == MaxUint256) {
    console.log('bunker is not started');
  } else {
    console.log('bunker start', new Date(Number(timestamp) * 1000));
  }
});

withdrawal.command('unfinalized-steth').action(async () => {
  const unfinalizedStETH = await withdrawalRequestContract.unfinalizedStETH();
  console.log('unfinalized stETH', formatEther(unfinalizedStETH));
});
