import { program } from '@command';
import { simpleDVTContract } from '@contracts';
import { addAragonAppSubCommands, addCuratedModuleSubCommands, addLogsCommands, addParsingCommands } from './common';
import { getLatestBlockRange, logger } from '@utils';
import { check0xSplit, checkGnosisSafe, checkSignatures, checkWrapperContract } from './staking-module';

const simpleDVT = program
  .command('simple-dvt')
  .aliases(['sdvt', 'sdvt-module'])
  .description('interact with simple dvt module contract');
addAragonAppSubCommands(simpleDVT, simpleDVTContract);
addParsingCommands(simpleDVT, simpleDVTContract);
addLogsCommands(simpleDVT, simpleDVTContract);
addCuratedModuleSubCommands(simpleDVT, simpleDVTContract);

simpleDVT
  .command('check-reward-address')
  .description('check split contracts')
  .argument('<reward-address>', 'cluster reward address')
  .option('-b, --blocks <number>', 'blocks', '1000000000')
  .action(async (rewardAddress, { blocks }) => {
    const [fromBlock, toBlock] = await getLatestBlockRange(blocks);

    const { splitWalletAddress } = await checkWrapperContract(rewardAddress, fromBlock, toBlock);
    await check0xSplit(splitWalletAddress, fromBlock, toBlock);
  });

simpleDVT
  .command('check-cluster-addresses')
  .description('check split contracts')
  .argument('<reward-address>', 'cluster reward address')
  .argument('<manager-address>', 'cluster manager address')
  .option('-b, --blocks <number>', 'blocks', '1000000000')
  .action(async (rewardAddress, managerAddress, { blocks }) => {
    const [fromBlock, toBlock] = await getLatestBlockRange(blocks);

    const { splitWalletAddress } = await checkWrapperContract(rewardAddress, fromBlock, toBlock);
    const { splitWalletAccounts } = await check0xSplit(splitWalletAddress, fromBlock, toBlock);

    await checkGnosisSafe(managerAddress, splitWalletAccounts);
  });

simpleDVT
  .command('check-cluster')
  .description('check split contracts')
  .argument('<cluster-name>', 'cluster name')
  .argument('<reward-address>', 'cluster reward address')
  .argument('<manager-address>', 'cluster manager address')
  .option('-b, --blocks <number>', 'blocks', '1000000000')
  .action(async (clusterName, rewardAddress, managerAddress, { blocks }) => {
    const [fromBlock, toBlock] = await getLatestBlockRange(blocks);

    const { splitWalletAddress } = await checkWrapperContract(rewardAddress, fromBlock, toBlock);
    const { splitWalletAccounts } = await check0xSplit(splitWalletAddress, fromBlock, toBlock);
    const { gnosisOwners } = await checkGnosisSafe(managerAddress, splitWalletAccounts);

    await checkSignatures(clusterName, gnosisOwners);
  });

simpleDVT
  .command('set-deadline')
  .description('Set exit deadline threshold for validators in sDVT module')
  .option('--threshold <seconds>', 'Exit deadline threshold in seconds (e.g., 345600 for 4 days)')
  .option('--reporting-window <seconds>', 'Late reporting window in seconds (e.g., 86400 for 1 day)', '86400')
  .action(async (options) => {
    const { threshold, reportingWindow } = options;

    if (!threshold) {
      logger.error('--threshold parameter is required');
      logger.log('');
      logger.log('Example usage:');
      logger.log('  lido-cli sdvt set-deadline --threshold 345600  # 4 days');
      logger.log(
        '  lido-cli sdvt set-deadline --threshold 345600 --reporting-window 86400  # 4 days threshold, 1 day window',
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
      logger.log('Setting exit deadline threshold in sDVT contract...');
      logger.log('Contract address:', simpleDVTContract.target);
      logger.log('New threshold:', thresholdSeconds, 'seconds');
      logger.log('Reporting window:', reportingWindowSeconds, 'seconds');

      const txResult = await simpleDVTContract.setExitDeadlineThreshold(thresholdSeconds, reportingWindowSeconds);

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
