import { formatEther, MaxUint256, parseEther, Result } from 'ethers';
import { program } from '@command';
import { wallet } from '@providers';
import { withdrawalRequestContract } from '@contracts';
import {
  addAccessControlSubCommands,
  addLogsCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
} from './common';
import { contractCallTxWithConfirm, logger } from '@utils';
import { addVersionedSubCommands } from './common/versioned';

const withdrawal = program
  .command('withdrawal-request')
  .aliases(['wq', 'withdrawal-queue'])
  .description('interact with withdrawal request contract');
addAccessControlSubCommands(withdrawal, withdrawalRequestContract);
addOssifiableProxyCommands(withdrawal, withdrawalRequestContract);
addParsingCommands(withdrawal, withdrawalRequestContract);
addPauseUntilSubCommands(withdrawal, withdrawalRequestContract);
addLogsCommands(withdrawal, withdrawalRequestContract);
addVersionedSubCommands(withdrawal, withdrawalRequestContract);

withdrawal
  .command('request')
  .description('request withdrawal')
  .argument('<amount>', 'stETH amount')
  .option('-a, --address <string>', 'owner address', wallet.address)
  .action(async (amount, options) => {
    const { address } = options;
    await contractCallTxWithConfirm(withdrawalRequestContract, 'requestWithdrawals', [[parseEther(amount)], address]);
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
    await contractCallTxWithConfirm(withdrawalRequestContract, 'requestWithdrawals', [requestsArray, address]);
  });

withdrawal
  .command('last-finalized')
  .description('returns last finalized request id')
  .action(async () => {
    const lastFinalizedRequestId = await withdrawalRequestContract.getLastFinalizedRequestId();
    logger.log('Last finalized request id', lastFinalizedRequestId);
  });

withdrawal
  .command('last-request')
  .description('returns last request id')
  .action(async () => {
    const lastRequestId = await withdrawalRequestContract.getLastRequestId();
    logger.log('Last request id', lastRequestId);
  });

withdrawal
  .command('user-requests')
  .description('returns user requests')
  .option('-a, --address <string>', 'owner address', wallet.address)
  .action(async (options) => {
    const { address } = options;
    const requestIds = await withdrawalRequestContract.getWithdrawalRequests(address);
    logger.log('Request ids', requestIds);
  });

withdrawal
  .command('status')
  .description('returns withdrawal status')
  .option('-a, --address <string>', 'owner address', wallet.address)
  .option('-l, --limit <number>', 'limit', '100')
  .action(async (options) => {
    const { address, limit } = options;
    const requestIds = await withdrawalRequestContract.getWithdrawalRequests(address);
    const limitedRequestIds = requestIds.slice(-Number(limit));
    const requests = await withdrawalRequestContract.getWithdrawalStatus(limitedRequestIds.toArray());

    requests.forEach((request: Result) => {
      logger.log(request.toObject());
    });
  });

withdrawal
  .command('claimable')
  .description('returns withdrawal status')
  .option('-a, --address <string>', 'owner address', wallet.address)
  .option('-l, --limit <number>', 'max ids amount per request', '100')
  .action(async (options) => {
    const { address, limit } = options;
    const requestIds: Result = await withdrawalRequestContract.getWithdrawalRequests(address);
    const sortedRequestIds: number[] = requestIds
      .toArray()
      .map((id) => Number(id))
      .sort((a, b) => a - b);

    // Split ids into batches
    const requestIdsBatches = [];
    for (let i = 0; i < sortedRequestIds.length; i += Number(limit)) {
      requestIdsBatches.push(sortedRequestIds.slice(i, i + Number(limit)));
    }

    // Get requests status in batches
    const requestsInBatches = await Promise.all(
      requestIdsBatches.map((batch) => withdrawalRequestContract.getWithdrawalStatus(batch)),
    );
    const requests = requestsInBatches.flat();

    // Filter out finalized and unclaimed requests
    const requestsWithId = sortedRequestIds.map((id, index) => ({ id, ...requests[index].toObject() }));
    const filteredRequests = requestsWithId.filter(
      (request) => request.isClaimed === false && request.isFinalized === true,
    );

    const filteredRequestsIds = filteredRequests.map((request) => request.id);

    if (filteredRequestsIds.length) {
      logger.log(filteredRequestsIds.join(','));
    } else {
      logger.log('No claimable requests');
    }
  });

withdrawal
  .command('claim')
  .description('claim withdrawal')
  .argument('<number>', 'request id')
  .action(async (requestId) => {
    await contractCallTxWithConfirm(withdrawalRequestContract, 'claimWithdrawal', [requestId]);
  });

withdrawal
  .command('claim-batch')
  .description('claim withdrawal')
  .argument('<request-ids>', 'request ids separated by comma')
  .action(async (requestIdsString) => {
    const requestIds = requestIdsString.split(',').map((id: string) => Number(id));

    const firstCheckpointIndex = 1;
    const lastCheckpointIndex = await withdrawalRequestContract.getLastCheckpointIndex();
    const hintsResult = await withdrawalRequestContract.findCheckpointHints(
      requestIds,
      firstCheckpointIndex,
      lastCheckpointIndex,
    );
    const hints = hintsResult.toArray();

    await contractCallTxWithConfirm(withdrawalRequestContract, 'claimWithdrawals', [requestIds, hints]);
  });

withdrawal
  .command('bunker')
  .description('returns if bunker mode is active')
  .action(async () => {
    const isBunker = await withdrawalRequestContract.isBunkerModeActive();
    logger.log('Bunker', isBunker);
  });

withdrawal
  .command('bunker-start')
  .description('returns bunker start timestamp')
  .action(async () => {
    const timestamp = await withdrawalRequestContract.bunkerModeSinceTimestamp();
    if (timestamp == MaxUint256) {
      logger.log('Bunker is not started');
    } else {
      logger.log('Bunker start', new Date(Number(timestamp) * 1000));
    }
  });

withdrawal
  .command('unfinalized-steth')
  .description('returns unfinalized stETH')
  .action(async () => {
    const unfinalizedStETH = await withdrawalRequestContract.unfinalizedStETH();
    logger.log('Unfinalized stETH', formatEther(unfinalizedStETH));
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
      BigInt(maxShareRate) * 10n ** 27n,
      Number(maxTimestamp),
      Number(maxRequestsPerCall),
      state,
    );

    const formattedResult = result.toObject();
    formattedResult.batches = formattedResult.batches.filter((v: unknown) => !!v);

    logger.log('Result', formattedResult);
  });

withdrawal
  .command('user-requests')
  .description('returns user requests')
  .option('-a, --address <string>', 'owner address', wallet.address)
  .action(async (options) => {
    const { address } = options;
    const requests = await withdrawalRequestContract.getWithdrawalRequests(address);
    logger.log('Requests', requests);
  });

withdrawal
  .command('max-batches')
  .description('returns max batches length')
  .action(async () => {
    const mxaBatches = await withdrawalRequestContract.MAX_BATCHES_LENGTH();
    logger.log('Max batches', mxaBatches);
  });
