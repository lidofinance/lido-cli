import { formatEther, MaxUint256, parseEther } from 'ethers';
import { program } from '@command';
import { wallet } from '@provider';
import { withdrawalRequestContract } from '@contracts';
import {
  addAccessControlSubCommands,
  addLogsCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
} from './common';
import { wrapTx } from '@utils';

const withdrawal = program.command('withdrawal-request').description('interact with withdrawal request contract');
addAccessControlSubCommands(withdrawal, withdrawalRequestContract);
addOssifiableProxyCommands(withdrawal, withdrawalRequestContract);
addParsingCommands(withdrawal, withdrawalRequestContract);
addPauseUntilSubCommands(withdrawal, withdrawalRequestContract);
addLogsCommands(withdrawal, withdrawalRequestContract);

withdrawal
  .command('request')
  .description('request withdrawal')
  .argument('<amount>', 'stETH amount')
  .option('-a, --address <string>', 'owner address', wallet.address)
  .action(async (amount, options) => {
    const { address } = options;
    await wrapTx(() => withdrawalRequestContract.requestWithdrawals([parseEther(amount)], address));
  });

withdrawal
  .command('requests')
  .description('request withdrawal')
  .argument('<amount>', 'stETH amount')
  .argument('<requests>', 'requests amount')
  .option('-a, --address <string>', 'owner address', wallet.address)
  .action(async (amount, requests, options) => {
    const { address } = options;
    const requestsArray = Array(Number(requests)).fill(parseEther(amount));
    await wrapTx(() => withdrawalRequestContract.requestWithdrawals(requestsArray, address));
  });

withdrawal
  .command('last-finalized')
  .description('returns last finalized request id')
  .action(async () => {
    const lastFinalizedRequestId = await withdrawalRequestContract.getLastFinalizedRequestId();
    console.log('last finalized request id', lastFinalizedRequestId);
  });

withdrawal
  .command('last-request')
  .description('returns last request id')
  .action(async () => {
    const lastRequestId = await withdrawalRequestContract.getLastRequestId();
    console.log('last request id', lastRequestId);
  });

withdrawal
  .command('claim')
  .description('claim withdrawal')
  .argument('<number>', 'request id')
  .action(async (requestId) => {
    await wrapTx(() => withdrawalRequestContract.claimWithdrawal(requestId));
  });

withdrawal
  .command('bunker')
  .description('returns if bunker mode is active')
  .action(async () => {
    const isBunker = await withdrawalRequestContract.isBunkerModeActive();
    console.log('bunker', isBunker);
  });

withdrawal
  .command('bunker-start')
  .description('returns bunker start timestamp')
  .action(async () => {
    const timestamp = await withdrawalRequestContract.bunkerModeSinceTimestamp();
    if (timestamp == MaxUint256) {
      console.log('bunker is not started');
    } else {
      console.log('bunker start', new Date(Number(timestamp) * 1000));
    }
  });

withdrawal
  .command('unfinalized-steth')
  .description('returns unfinalized stETH')
  .action(async () => {
    const unfinalizedStETH = await withdrawalRequestContract.unfinalizedStETH();
    console.log('unfinalized stETH', formatEther(unfinalizedStETH));
  });

withdrawal
  .command('finalization-batches')
  .description('returns finalization batches')
  .option('-s, --max-share-rate <number>', 'max share rate', '1')
  .option('-r, --max-requests-per-call <number>', 'max requests per call', '1000')
  .option('-t, --max-timestamp <number>', 'max timestamp', `${Math.floor(Date.now() / 1000)}`)
  .option('-e, --eth-budget <number>', 'eth budget', '1')
  .action(async (options) => {
    const { maxShareRate, maxTimestamp, maxRequestsPerCall, ethBudget } = options;
    const state = [parseEther(ethBudget), false, Array(36).fill(0), 0];

    const result = await withdrawalRequestContract.calculateFinalizationBatches(
      BigInt(maxShareRate) * BigInt(1e27),
      Number(maxTimestamp),
      Number(maxRequestsPerCall),
      state,
    );

    const formattedResult = result.toObject();
    formattedResult.batches = formattedResult.batches.filter((v) => !!v);

    console.log('result', formattedResult);
  });

withdrawal
  .command('user-requests')
  .description('returns user requests')
  .option('-a, --address <string>', 'owner address', wallet.address)
  .action(async (options) => {
    const { address } = options;
    const requests = await withdrawalRequestContract.getWithdrawalRequests(address);
    console.log('requests', requests);
  });

withdrawal
  .command('max-batches')
  .description('returns max batches length')
  .action(async () => {
    const mxaBatches = await withdrawalRequestContract.MAX_BATCHES_LENGTH();
    console.log('max batches', mxaBatches);
  });
