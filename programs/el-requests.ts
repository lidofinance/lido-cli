import { program } from '@command';
import { logger, txWithConfirmation, validatePubkey } from '@utils';
import { formatEther, parseEther, solidityPacked } from 'ethers';
import chalk from 'chalk';

const title = chalk.white.bold.green;
const grey = chalk.white.grey;

const requests = program
  .command('execution-layer-requests')
  .aliases(['el-requests', 'elr'])
  .description('interact with execution layer requests contracts');

const WITHDRAWAL_REQUEST_CONTRACT = '0x0c15F14308530b7CDB8460094BbB9cC28b9AaaAA';
const CONSOLIDATION_REQUEST_CONTRACT = '0x00431F263cE400f4455c2dCf564e53007Ca4bbBb';

requests
  .command('withdrawal-request')
  .aliases(['wr', 'withdrawal'])
  .description('send withdrawal request')
  .argument('<pubkey>', 'validator pubkey')
  .argument('[amount]', 'amount to winthdraw', '0')
  .argument('[fee]', 'request fee', '0.01')
  .action(async (pubkey, amount, fee) => {
    validatePubkey(pubkey);

    const feeInWei = parseEther(fee);

    const amountInWei = parseEther(amount);
    const amountInGwei = amountInWei / 10n ** 9n;
    const amountBytes = solidityPacked(['uint64'], [amountInGwei]);

    const data = pubkey + amountBytes.slice(2);

    logger.log();
    logger.log(title('Withdrawal request'));
    logger.log(grey('Pubkey:'), pubkey);
    logger.log(grey('Amount:'), `${formatEther(amountInWei)} ETH`);
    logger.log(grey('   Fee:'), `${formatEther(feeInWei)} ETH`);
    logger.log();

    await txWithConfirmation(WITHDRAWAL_REQUEST_CONTRACT, feeInWei, data);
  });

requests
  .command('consolidation-request')
  .aliases(['cr', 'consolidation'])
  .description('send consolidation request')
  .argument('<source-pubkey>', 'source validator pubkey')
  .argument('<target-pubkey>', 'target validator pubkey')
  .argument('[fee]', 'request fee', '0.01')
  .action(async (sourcePubkey, targetPubkey, fee) => {
    validatePubkey(sourcePubkey);
    validatePubkey(targetPubkey);

    const feeInWei = parseEther(fee);
    const data = sourcePubkey + targetPubkey.slice(2);

    logger.log();
    logger.log(title('Consolidation request'));
    logger.log(grey('Source pubkey:'), sourcePubkey);
    logger.log(grey('Target pubkey:'), targetPubkey);
    logger.log(grey('          Fee:'), `${formatEther(feeInWei)} ETH`);
    logger.log();

    await txWithConfirmation(CONSOLIDATION_REQUEST_CONTRACT, feeInWei, data);
  });
