import { MaxUint256 } from 'ethers';
import { program } from '../command';
import { withdrawalRequestContract } from '../contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const withdrawal = program.command('withdrawal-request');
addAccessControlSubCommands(withdrawal, withdrawalRequestContract);
addParsingCommands(withdrawal, withdrawalRequestContract);

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
