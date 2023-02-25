import { program } from '@command';
import { sanityCheckerContract } from '@contracts';
import { addAccessControlSubCommands, addConsensusCommands, addParsingCommands } from './common';

const sanityChecker = program.command('sanity-checker').description('interact with sanity checker contract');
addAccessControlSubCommands(sanityChecker, sanityCheckerContract);
addParsingCommands(sanityChecker, sanityCheckerContract);

sanityChecker
  .command('limits')
  .description('returns oracle report limits')
  .action(async () => {
    const limits = await sanityCheckerContract.getOracleReportLimits();
    const {
      churnValidatorsPerDayLimit,
      oneOffCLBalanceDecreaseBPLimit,
      annualBalanceIncreaseBPLimit,
      shareRateDeviationBPLimit,
      requestTimestampMargin,
      maxPositiveTokenRebase,
      maxValidatorExitRequestsPerReport,
      maxAccountingExtraDataListItemsCount,
    } = limits;

    console.log('limits', {
      churnValidatorsPerDayLimit,
      oneOffCLBalanceDecreaseBPLimit,
      annualBalanceIncreaseBPLimit,
      shareRateDeviationBPLimit,
      requestTimestampMargin,
      maxPositiveTokenRebase,
      maxValidatorExitRequestsPerReport,
      maxAccountingExtraDataListItemsCount,
    });
  });

sanityChecker
  .command('set-share-rate-limit')
  .description('sets share rate limit')
  .argument('<limit>', 'share rate limit in BP')
  .action(async (limit) => {
    await sanityCheckerContract.setShareRateDeviationBPLimit(Number(limit));
    console.log('updated');
  });
