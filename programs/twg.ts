import { program } from '@command';
import { twgContract } from '@contracts';
import { logger } from '@utils';

const twg = program.command('twg').description('interact with Triggerable Withdrawals Gateway contract');

twg
  .command('set-limits')
  .description('Change exit limits on TWG contract')
  .option('--max-exit-requests-limit <limit>', 'Maximum exit requests limit')
  .option('--exits-per-frame <exits>', 'Number of exits per frame')
  .option('--frame-duration <duration>', 'Frame duration in seconds')
  .action(async (options) => {
    const { maxExitRequestsLimit, exitsPerFrame, frameDuration } = options;

    if (!maxExitRequestsLimit || !exitsPerFrame || !frameDuration) {
      logger.error('All parameters are required:');
      logger.log('  --max-exit-requests-limit <limit>');
      logger.log('  --exits-per-frame <exits>');
      logger.log('  --frame-duration <duration>');
      logger.log('');
      logger.log('Example usage:');
      logger.log('  lido-cli twg set-limits --max-exit-requests-limit 11200 --exits-per-frame 1 --frame-duration 48');
      return;
    }

    const maxLimit = parseInt(maxExitRequestsLimit, 10);
    const exitsPerFrameNum = parseInt(exitsPerFrame, 10);
    const frameDurationNum = parseInt(frameDuration, 10);

    if (isNaN(maxLimit) || isNaN(exitsPerFrameNum) || isNaN(frameDurationNum)) {
      logger.error('All parameters must be valid numbers');
      return;
    }

    if (maxLimit <= 0 || exitsPerFrameNum <= 0 || frameDurationNum <= 0) {
      logger.error('All parameters must be positive numbers');
      return;
    }

    try {
      logger.log('Setting exit limits on TWG contract...');
      logger.log('Contract address:', twgContract.target);
      logger.log('Parameters:');
      logger.log('  Max exit requests limit:', maxLimit);
      logger.log('  Exits per frame:', exitsPerFrameNum);
      logger.log('  Frame duration (seconds):', frameDurationNum);

      const txResult = await twgContract.setExitRequestLimit(maxLimit, exitsPerFrameNum, frameDurationNum);

      logger.log('Transaction hash:', txResult.hash);
      logger.log('Waiting for transaction confirmation...');

      const receipt = await txResult.wait();

      if (receipt.status === 1) {
        logger.log('Exit limits updated successfully!');
        logger.log('Transaction confirmed in block:', receipt.blockNumber);
      } else {
        logger.error('Transaction failed');
      }
    } catch (error) {
      logger.error('Failed to set exit limits:', error);
    }
  });

twg
  .command('get-limits')
  .description('Get current exit request limits from TWG contract')
  .action(async () => {
    try {
      logger.log('Retrieving current exit limits from TWG contract...');
      logger.log('Contract address:', twgContract.target);

      const limitsInfo = await twgContract.getExitRequestLimitFullInfo();

      const [maxExitRequestsLimit, exitsPerFrame, frameDurationInSec, prevExitRequestsLimit, currentExitRequestsLimit] =
        limitsInfo;

      logger.log('');
      logger.log('Current Exit Request Limits:');
      logger.log(`max-exit-requests-limit: ${maxExitRequestsLimit}`);
      logger.log(`exits-per-frame: ${exitsPerFrame}`);
      logger.log(`frame-duration: ${frameDurationInSec}`);
      logger.log('');
      logger.log('Additional Info:');
      logger.log(`prev-exit-requests-limit: ${prevExitRequestsLimit}`);
      logger.log(`current-exit-requests-limit: ${currentExitRequestsLimit}`);
    } catch (error) {
      logger.error('Failed to retrieve exit request limits:', error);
    }
  });
