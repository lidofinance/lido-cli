import { program } from '@command';
import { sanityCheckerContract } from '@contracts';
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
    console.log('limits', limits.toObject());
  });

sanityChecker
  .command('set-share-rate-limit')
  .description('sets share rate limit')
  .argument('<limit>', 'share rate limit in BP')
  .action(async (limit) => {
    await sanityCheckerContract.setShareRateDeviationBPLimit(Number(limit));
    console.log('updated');
  });

sanityChecker
  .command('set-annual-cl-increase-limit')
  .description('sets annual cl increase limit')
  .argument('<limit>', 'annual cl increase limit in BP')
  .action(async (limit) => {
    await sanityCheckerContract.setAnnualBalanceIncreaseBPLimit(Number(limit));
    console.log('updated');
  });
