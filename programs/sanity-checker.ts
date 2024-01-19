import { program } from '@command';
import { sanityCheckerContract } from '@contracts';
import { authorizedCall, logger } from '@utils';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands } from './common';

const sanityChecker = program.command('sanity-checker').description('interact with sanity checker contract');
addAccessControlSubCommands(sanityChecker, sanityCheckerContract);
addParsingCommands(sanityChecker, sanityCheckerContract);
addLogsCommands(sanityChecker, sanityCheckerContract);

sanityChecker
  .command('limits')
  .description('returns oracle report limits')
  .action(async () => {
    const limits = await sanityCheckerContract.getOracleReportLimits();
    logger.log('Limits', limits.toObject());
  });

sanityChecker
  .command('set-share-rate-limit')
  .description('sets share rate limit')
  .argument('<limit>', 'share rate limit in BP')
  .action(async (limit) => {
    await authorizedCall(sanityCheckerContract, 'setShareRateDeviationBPLimit', [Number(limit)]);
  });

sanityChecker
  .command('set-annual-cl-increase-limit')
  .description('sets annual cl increase limit')
  .argument('<limit>', 'annual cl increase limit in BP')
  .action(async (limit) => {
    await authorizedCall(sanityCheckerContract, 'setAnnualBalanceIncreaseBPLimit', [Number(limit)]);
  });

sanityChecker
  .command('set-max-positive-token-rebase')
  .description('sets max positive token rebase')
  .argument('<limit>', 'max positive token rebase')
  .action(async (limit) => {
    await authorizedCall(sanityCheckerContract, 'setMaxPositiveTokenRebase', [Number(limit)]);
  });

sanityChecker
  .command('set-max-accounting-extra-data-list-items-count')
  .description('sets max accounting extra data list items count')
  .argument('<limit>', 'max extra data list items count')
  .action(async (limit) => {
    await authorizedCall(sanityCheckerContract, 'setMaxAccountingExtraDataListItemsCount', [Number(limit)]);
  });

sanityChecker
  .command('set-max-node-operators-per-extra-data-item-count')
  .description('sets max node operators per extra data item count')
  .argument('<limit>', 'max node operators per extra data item count')
  .action(async (limit) => {
    await authorizedCall(sanityCheckerContract, 'setMaxNodeOperatorsPerExtraDataItemCount', [Number(limit)]);
  });

sanityChecker
  .command('set-oracle-report-limits')
  .description('sets oracle report limits')
  .argument('<churn-validators-per-day-limit>', 'churn validators per day limit')
  .argument('<one-off-cl-balance-decrease-bp-limit>', 'one off cl balance decrease limit in BP')
  .argument('<annual-balance-increase-bp-limit>', 'annual balance increase limit in BP')
  .argument('<simulated-share-rate-deviation-bp-limit>', 'simulated share rate deviation limit in BP')
  .argument('<max-validator-exit-requests-per-report>', 'max validator exit requests per report')
  .argument('<max-accounting-extra-data-list-items-count>', 'max accounting extra data list items count')
  .argument('<max-node-operators-per-extra-data-item-count>', 'max node operators per extra data item count')
  .argument('<request-timestamp-margin>', 'request timestamp margin')
  .argument('<max-positive-token-rebase>', 'max positive token rebase')
  .action(
    async (
      churnValidatorsPerDayLimit,
      oneOffCLBalanceDecreaseBPLimit,
      annualBalanceIncreaseBPLimit,
      simulatedShareRateDeviationBPLimit,
      maxValidatorExitRequestsPerReport,
      maxAccountingExtraDataListItemsCount,
      maxNodeOperatorsPerExtraDataItemCount,
      requestTimestampMargin,
      maxPositiveTokenRebase,
    ) => {
      await authorizedCall(sanityCheckerContract, 'setOracleReportLimits', [
        {
          churnValidatorsPerDayLimit: Number(churnValidatorsPerDayLimit),
          oneOffCLBalanceDecreaseBPLimit: Number(oneOffCLBalanceDecreaseBPLimit),
          annualBalanceIncreaseBPLimit: Number(annualBalanceIncreaseBPLimit),
          simulatedShareRateDeviationBPLimit: Number(simulatedShareRateDeviationBPLimit),
          maxValidatorExitRequestsPerReport: Number(maxValidatorExitRequestsPerReport),
          maxAccountingExtraDataListItemsCount: Number(maxAccountingExtraDataListItemsCount),
          maxNodeOperatorsPerExtraDataItemCount: Number(maxNodeOperatorsPerExtraDataItemCount),
          requestTimestampMargin: Number(requestTimestampMargin),
          maxPositiveTokenRebase: Number(maxPositiveTokenRebase),
        },
      ]);
    },
  );
