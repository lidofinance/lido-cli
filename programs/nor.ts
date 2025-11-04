import { program } from '@command';
import { norContract } from '@contracts';
import { logger } from '@utils';
import { addAragonAppSubCommands, addCuratedModuleSubCommands, addLogsCommands, addParsingCommands } from './common';

const nor = program
  .command('nor')
  .aliases(['curated', 'curated-module'])
  .description('interact with node operator registry contract');
addAragonAppSubCommands(nor, norContract);
addParsingCommands(nor, norContract);
addLogsCommands(nor, norContract);
addCuratedModuleSubCommands(nor, norContract);

nor
  .command('set-deadline')
  .description('Set exit deadline threshold for validators in NOR module')
  .option('--threshold <seconds>', 'Exit deadline threshold in seconds (e.g., 345600 for 4 days)')
  .option('--reporting-window <seconds>', 'Late reporting window in seconds (e.g., 86400 for 1 day)', '86400')
  .action(async (options) => {
    const { threshold, reportingWindow } = options;

    if (!threshold) {
      logger.error('--threshold parameter is required');
      logger.log('');
      logger.log('Example usage:');
      logger.log('  lido-cli nor set-deadline --threshold 345600  # 4 days');
      logger.log(
        '  lido-cli nor set-deadline --threshold 345600 --reporting-window 86400  # 4 days threshold, 1 day window',
      );
      return;
    }

    const thresholdSeconds = parseInt(threshold, 10);
    const reportingWindowSeconds = parseInt(reportingWindow, 10);

    if (isNaN(thresholdSeconds)) {
      logger.error('Threshold must be a valid number (seconds)');
      return;
    }

    if (isNaN(reportingWindowSeconds)) {
      logger.error('Reporting window must be a valid number (seconds)');
      return;
    }

    if (thresholdSeconds < 0) {
      logger.error('Threshold must be a positive number');
      return;
    }

    if (reportingWindowSeconds < 0) {
      logger.error('Reporting window must be a positive number');
      return;
    }

    try {
      logger.log('Setting exit deadline threshold in NOR contract...');
      logger.log('Contract address:', norContract.target);
      logger.log('New threshold:', thresholdSeconds, 'seconds');
      logger.log('Reporting window:', reportingWindowSeconds, 'seconds');

      const txResult = await norContract.setExitDeadlineThreshold(thresholdSeconds, reportingWindowSeconds);

      logger.log('Transaction hash:', txResult.hash);
      logger.log('Waiting for transaction confirmation...');

      const receipt = await txResult.wait();

      if (receipt.status === 1) {
        logger.log('Exit deadline threshold updated successfully!');
        logger.log('Transaction confirmed in block:', receipt.blockNumber);
      } else {
        logger.error('Transaction failed');
      }
    } catch (error) {
      logger.error('Failed to set exit deadline threshold:', error);
    }
  });
