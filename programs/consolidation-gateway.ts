import { program } from '@command';
import { consolidationGatewayContract, withdrawalVaultContract } from '@contracts';
import { wallet } from '@providers';
import { contractCallTxWithConfirm, logger, splitHex, validatePubkey } from '@utils';
import { formatEther } from 'ethers';
import chalk from 'chalk';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands, addPauseUntilSubCommands } from './common';

const title = chalk.white.bold.green;
const grey = chalk.white.grey;

const consolidationGateway = program
  .command('consolidation-gateway')
  .aliases(['cg', 'consolidation'])
  .description('interact with consolidation gateway contract');

// Add common sub-commands
addAccessControlSubCommands(consolidationGateway, consolidationGatewayContract);
addParsingCommands(consolidationGateway, consolidationGatewayContract);
addPauseUntilSubCommands(consolidationGateway, consolidationGatewayContract);
addLogsCommands(consolidationGateway, consolidationGatewayContract);

consolidationGateway
  .command('add-consolidation-requests')
  .aliases(['add', 'acr'])
  .description(
    'add consolidation requests for validator pairs (source != target merges balances, source == target converts 0x01 to 0x02 compounding)',
  )
  .argument('<source-pubkeys>', 'comma-separated source validator pubkeys or concatenated hex string')
  .argument('<target-pubkeys>', 'comma-separated target validator pubkeys or concatenated hex string')
  .option('-r, --refund-recipient <address>', 'refund recipient address', wallet.address)
  .action(async (sourcePubkeysInput, targetPubkeysInput, options) => {
    const { refundRecipient } = options;

    let sourcePubkeys: string[];
    let targetPubkeys: string[];

    // Handle different input formats
    if (sourcePubkeysInput.includes(',')) {
      sourcePubkeys = sourcePubkeysInput.split(',').map((pk: string) => pk.trim());
    } else {
      sourcePubkeys = splitHex(sourcePubkeysInput, 96);
    }

    if (targetPubkeysInput.includes(',')) {
      targetPubkeys = targetPubkeysInput.split(',').map((pk: string) => pk.trim());
    } else {
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

    // Get fee from WithdrawalVault
    const feePerRequest: bigint = await withdrawalVaultContract.getConsolidationRequestFee();
    const totalFee = feePerRequest * BigInt(consolidationCount);

    logger.log();
    logger.log(title('Add Consolidation Requests'));
    logger.log(grey('Source pubkeys:'), sourcePubkeys.length);
    logger.log(grey('Target pubkeys:'), targetPubkeys.length);
    logger.log(grey('Refund recipient:'), refundRecipient);
    logger.log(grey('Fee per request:'), `${formatEther(feePerRequest)} ETH`);
    logger.log(grey('Total fee:'), `${formatEther(totalFee)} ETH`);
    logger.log();

    // Show first few pubkey pairs for verification
    for (let i = 0; i < Math.min(3, consolidationCount); i++) {
      const isSameKey = sourcePubkeys[i] === targetPubkeys[i];
      logger.log(grey(`Pair ${i + 1}${isSameKey ? ' (0x01→0x02 compounding)' : ''}:`));
      logger.log(grey('  Source:'), sourcePubkeys[i]);
      logger.log(grey('  Target:'), targetPubkeys[i]);
    }
    if (consolidationCount > 3) {
      logger.log(grey(`... and ${consolidationCount - 3} more pairs`));
    }
    logger.log();

    await contractCallTxWithConfirm(consolidationGatewayContract, 'addConsolidationRequests', [
      sourcePubkeys,
      targetPubkeys,
      refundRecipient,
      { value: totalFee },
    ]);
  });
