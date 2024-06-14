import { program } from '@command';
import { fetchEtherscanSignatureDetailsForAddress } from './etherscan/';
import { logger } from '@utils';

const etherscan = program.command('etherscan').description('etherscan commands');

etherscan
  .command('verified-signatures')
  .aliases(['signatures'])
  .argument('<address>', 'address')
  .action(async (address) => {
    const signedMessages = await fetchEtherscanSignatureDetailsForAddress(address);

    signedMessages.map(({ message, signature }) => {
      logger.log('');
      logger.log('Message:  ', message);
      logger.log('Signature:', signature);
    });

    logger.log('');
  });
