import { program } from '@command';
import { provider, wallet } from '@providers';
import { logger, txWithConfirmation } from '@utils';
import { formatEther, parseEther } from 'ethers';

const eth = program.command('eth').aliases(['ether']).description('transfer ether');

eth
  .command('balance')
  .description('returns balance')
  .argument('[address]', 'address', wallet.address)
  .action(async (address) => {
    const balance = await provider.getBalance(address);
    logger.log('Balance', formatEther(balance), 'ETH');
  });

eth
  .command('transfer')
  .description('transfer ether to address')
  .argument('<to>', 'to address')
  .argument('<amount>', 'ether amount')
  .action(async (to, amount) => {
    await txWithConfirmation(to, parseEther(amount), '0x');
  });
