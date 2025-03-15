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
  .argument('<exitedValidatorsPerDayLimit>', 'exited validators per day limit')
  .argument('<appearedValidatorsPerDayLimit>', 'appeared validators per day limit')
  .argument('<annualBalanceIncreaseBPLimit>', 'annual balance increase BP limit')
  .argument('<simulatedShareRateDeviationBPLimit>', 'simulated share rate deviation BP limit')
  .argument('<maxValidatorExitRequestsPerReport>', 'max validator exit requests per report')
  .argument('<maxItemsPerExtraDataTransaction>', 'max items per extra data transaction')
  .argument('<maxNodeOperatorsPerExtraDataItem>', 'max node operators per extra data item')
  .argument('<requestTimestampMargin>', 'request timestamp margin')
  .argument('<maxPositiveTokenRebase>', 'max positive token rebase')
  .argument('<initialSlashingAmountPWei>', 'initial slashing amount PWei')
  .argument('<inactivityPenaltiesAmountPWei>', 'inactivity penalties amount PWei')
  .argument('<clBalanceOraclesErrorUpperBPLimit>', 'CL balance oracles error upper BP limit')
  .argument('<secondOpinionOracle>', 'second opinion oracle')
  .action(
    async (
      exitedValidatorsPerDayLimit,
      appearedValidatorsPerDayLimit,
      annualBalanceIncreaseBPLimit,
      simulatedShareRateDeviationBPLimit,
      maxValidatorExitRequestsPerReport,
      maxItemsPerExtraDataTransaction,
      maxNodeOperatorsPerExtraDataItem,
      requestTimestampMargin,
      maxPositiveTokenRebase,
      initialSlashingAmountPWei,
      inactivityPenaltiesAmountPWei,
      clBalanceOraclesErrorUpperBPLimit,
      secondOpinionOracle,
    ) => {
      await authorizedCall(sanityCheckerContract, 'setOracleReportLimits', [
        {
          exitedValidatorsPerDayLimit: Number(exitedValidatorsPerDayLimit),
          appearedValidatorsPerDayLimit: Number(appearedValidatorsPerDayLimit),
          annualBalanceIncreaseBPLimit: Number(annualBalanceIncreaseBPLimit),
          simulatedShareRateDeviationBPLimit: Number(simulatedShareRateDeviationBPLimit),
          maxValidatorExitRequestsPerReport: Number(maxValidatorExitRequestsPerReport),
          maxItemsPerExtraDataTransaction: Number(maxItemsPerExtraDataTransaction),
          maxNodeOperatorsPerExtraDataItem: Number(maxNodeOperatorsPerExtraDataItem),
          requestTimestampMargin: Number(requestTimestampMargin),
          maxPositiveTokenRebase: Number(maxPositiveTokenRebase),
          initialSlashingAmountPWei: Number(initialSlashingAmountPWei),
          inactivityPenaltiesAmountPWei: Number(inactivityPenaltiesAmountPWei),
          clBalanceOraclesErrorUpperBPLimit: Number(clBalanceOraclesErrorUpperBPLimit),
        },
        secondOpinionOracle,
      ]);
    },
  );
