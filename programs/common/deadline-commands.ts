import { Command } from 'commander';
import { Contract } from 'ethers';
import { logger } from '@utils';

interface DeadlineCommandConfig {
  /** Module name for logs and descriptions (e.g., "NOR", "sDVT") */
  moduleName: string;
  /** Command name for usage examples (e.g., "nor", "sdvt") */
  commandName: string;
}

export const addDeadlineCommands = (command: Command, contract: Contract, config: DeadlineCommandConfig) => {
  command
    .command('set-deadline')
    .description(
      `Set exit deadline threshold for validators in ${config.moduleName} module. Note: validators exited before now will no longer be able to report as late again`,
    )
    .option('--threshold <seconds>', 'Exit deadline threshold in seconds (e.g., 345600 for 4 days)')
    .option('--reporting-window <seconds>', 'Late reporting window in seconds (e.g., 86400 for 1 day)', '86400')
    .action(async (options) => {
      const { threshold, reportingWindow } = options;

      if (!threshold) {
        logger.error('--threshold parameter is required');
        logger.log('');
        logger.log('Example usage:');
        logger.log(`  lido-cli ${config.commandName} set-deadline --threshold 345600  # 4 days`);
        logger.log(
          `  lido-cli ${config.commandName} set-deadline --threshold 345600 --reporting-window 86400  # 4 days threshold, 1 day window`,
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
        logger.log(`Setting exit deadline threshold in ${config.moduleName} contract...`);
        logger.log('Contract address:', contract.target);
        logger.log('New threshold:', thresholdSeconds, 'seconds');
        logger.log('Reporting window:', reportingWindowSeconds, 'seconds');

        const txResult = await contract.setExitDeadlineThreshold(thresholdSeconds, reportingWindowSeconds);

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

  command
    .command('get-deadline')
    .description(`Get current exit deadline threshold for a Node Operator in ${config.moduleName} module`)
    .option('--node-operator-id <id>', 'Node Operator ID to query')
    .action(async (options) => {
      const { nodeOperatorId } = options;

      if (!nodeOperatorId) {
        logger.error('--node-operator-id parameter is required');
        logger.log('');
        logger.log('Example usage:');
        logger.log(`  lido-cli ${config.commandName} get-deadline --node-operator-id 15`);
        return;
      }

      const operatorId = parseInt(nodeOperatorId, 10);

      if (isNaN(operatorId)) {
        logger.error('Node Operator ID must be a valid number');
        return;
      }

      if (operatorId < 0) {
        logger.error('Node Operator ID must be a non-negative number');
        return;
      }

      try {
        logger.log(`Retrieving exit deadline threshold from ${config.moduleName} contract...`);
        logger.log('Contract address:', contract.target);
        logger.log('Node Operator ID:', operatorId);

        const threshold = await contract.exitDeadlineThreshold(operatorId);

        logger.log('');
        logger.log(`threshold: ${threshold}`);
      } catch (error) {
        logger.error('Failed to retrieve exit deadline threshold:', error);
      }
    });
};
