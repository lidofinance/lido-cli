import { program } from '@command';
import { consolidationGatewayContract } from '@contracts';
import { wallet } from '@providers';
import { contractCallTxWithConfirm, logger, splitHex, validatePubkey } from '@utils';
import { formatEther, parseEther } from 'ethers';
import chalk from 'chalk';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands, addPauseUntilSubCommands } from './common';

const title = chalk.white.bold.green;
const grey = chalk.white.grey;

const consolidationGateway = program
  .command('consolidation-gateway')
  .aliases(['cg'])
  .description('interact with consolidation gateway contract');

// Add common sub-commands
addAccessControlSubCommands(consolidationGateway, consolidationGatewayContract);
addParsingCommands(consolidationGateway, consolidationGatewayContract);
addPauseUntilSubCommands(consolidationGateway, consolidationGatewayContract);
addLogsCommands(consolidationGateway, consolidationGatewayContract);

consolidationGateway
  .command('trigger-consolidation')
  .aliases(['trigger', 'tc'])
  .description('trigger consolidation for validator pairs')
  .argument('<source-pubkeys>', 'comma-separated source validator pubkeys or concatenated hex string')
  .argument('<target-pubkeys>', 'comma-separated target validator pubkeys or concatenated hex string')
  .option('-r, --refund-recipient <address>', 'refund recipient address', wallet.address)
  .option('-f, --fee <fee>', 'fee per consolidation in ETH', '0.01')
  .action(async (sourcePubkeysInput, targetPubkeysInput, options) => {
    const { refundRecipient, fee } = options;

    let sourcePubkeys: string[];
    let targetPubkeys: string[];

    // Handle different input formats
    if (sourcePubkeysInput.includes(',')) {
      // Comma-separated format
      sourcePubkeys = sourcePubkeysInput.split(',').map((pk: string) => pk.trim());
    } else {
      // Concatenated hex string format
      sourcePubkeys = splitHex(sourcePubkeysInput, 96);
    }

    if (targetPubkeysInput.includes(',')) {
      // Comma-separated format
      targetPubkeys = targetPubkeysInput.split(',').map((pk: string) => pk.trim());
    } else {
      // Concatenated hex string format
      targetPubkeys = splitHex(targetPubkeysInput, 96);
    }

    // Validate arrays have same length
    if (sourcePubkeys.length !== targetPubkeys.length) {
      throw new Error('Source and target pubkeys arrays must have the same length');
    }

    // Validate all pubkeys
    sourcePubkeys.forEach(validatePubkey);
    targetPubkeys.forEach(validatePubkey);

    const consolidationCount = sourcePubkeys.length;
    const feePerConsolidation = parseEther(fee);
    const totalFee = feePerConsolidation * BigInt(consolidationCount);

    logger.log();
    logger.log(title('Trigger Consolidation'));
    logger.log(grey('Source pubkeys:'), sourcePubkeys.length);
    logger.log(grey('Target pubkeys:'), targetPubkeys.length);
    logger.log(grey('Refund recipient:'), refundRecipient);
    logger.log(grey('Fee per consolidation:'), `${formatEther(feePerConsolidation)} ETH`);
    logger.log(grey('Total fee:'), `${formatEther(totalFee)} ETH`);
    logger.log();

    // Show first few pubkey pairs for verification
    for (let i = 0; i < Math.min(3, consolidationCount); i++) {
      logger.log(grey(`Pair ${i + 1}:`));
      logger.log(grey('  Source:'), sourcePubkeys[i]);
      logger.log(grey('  Target:'), targetPubkeys[i]);
    }
    if (consolidationCount > 3) {
      logger.log(grey(`... and ${consolidationCount - 3} more pairs`));
    }
    logger.log();

    await contractCallTxWithConfirm(consolidationGatewayContract, 'triggerConsolidation', [
      sourcePubkeys,
      targetPubkeys,
      refundRecipient,
      { value: totalFee },
    ]);
  });
