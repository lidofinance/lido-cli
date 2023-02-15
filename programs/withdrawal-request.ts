import { MaxUint256, toBeHex } from 'ethers';
import { program } from '../command';
import { withdrawalRequestContract } from '../contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const withdrawal = program.command('withdrawal-request');
addAccessControlSubCommands(withdrawal, withdrawalRequestContract);
addParsingCommands(withdrawal, withdrawalRequestContract);

withdrawal.command('is-paused').action(async () => {
  const paused = await withdrawalRequestContract.isPaused();
  console.log('paused', paused);
});

withdrawal.command('resume').action(async () => {
  await withdrawalRequestContract.resume();
  console.log('resumed');
});

withdrawal
  .command('pause')
  .option('-d, --duration <string>', 'pause duration', toBeHex(MaxUint256))
  .action(async (options) => {
    const { duration } = options;
    await withdrawalRequestContract.pause(duration);
    console.log('paused');
  });

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
