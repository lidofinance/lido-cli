import { program } from '@command';
import { logger } from '@utils';
import { supplementAndVerifyDepositDataArray } from 'utils/deposit-data';

const keys = program.command('deposit-data').aliases(['keys']).description('deposit-data utils');

keys
  .command('verify')
  .description('verify deposit data')
  .argument('<file-path>', 'path to the deposit data file')
  .action(async (filePath) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const depositDataArray = require(filePath);
    await supplementAndVerifyDepositDataArray(depositDataArray);
    logger.log('Deposit data is valid, keys checked', depositDataArray.length);
  });
