import { program } from '@command';
import { getLatestBlock } from '../utils/block';
import { depositContract } from '../contracts/deposit-contract';
import { provider } from '../providers/el-provider';
import chalk from 'chalk';

const elNode = program.command('el-node').description('test execution node capabilities');

elNode
  .command('is-synced')
  .description('check node is synced')
  .action(async () => {
    const latestBlockFromNode = await getLatestBlock();

    const tolerance = 10 * 1000; // 10 seconds

    const now = Math.floor(Date.now() / 1000);
    const diff = (now - latestBlockFromNode.timestamp);
    const isSynced = (diff) < tolerance;

    console.table({ isSynced, 'timestamp(node)': latestBlockFromNode.timestamp, 'timestamp(local)': now, diff});
  });

elNode
  .command('is-archive')
  .description('check node is in archive mode')
  .action(async () => {
    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZoneName: 'short',
      hour12: false,
    };
    const intl = new Intl.DateTimeFormat('en-GB', formatOptions);

    let step = 5000;

    const blockDeep = 100 * 1000;
    const latestBlock = await getLatestBlock();
    const latestBlockNumber = latestBlock.number;
    const deepestBlockNumber = latestBlockNumber - blockDeep;

    console.log('latest block', latestBlockNumber, intl.format(latestBlock.timestamp * 1000));
    let blockToCheck = latestBlockNumber;
    let lastSuccessfulBlockCheck = latestBlockNumber;
    let checkCount = 0;
    let output: (string | number)[]  = [];
    while (blockToCheck >= deepestBlockNumber) {
      try {
        const deep = blockToCheck - latestBlockNumber;
        const block = await provider.getBlock(blockToCheck);

        output = ['checking block', deep, intl.format((block?.timestamp ?? 0) * 1000)];

        await depositContract.get_deposit_count({blockTag: blockToCheck});
        lastSuccessfulBlockCheck = blockToCheck;

        console.log.apply(this, [...output, chalk.green('History OK')]);
      } catch (e) {
        if (e instanceof Error) {
          console.log.apply(this, [...output, chalk.green('History ') + chalk.red('FAIL'), chalk.magenta(`Can't get historic data:`), `${e.message.substring(0, 60)}...`]);
        }
        if (checkCount < 10) {
          step = Math.floor(step / 5);
          blockToCheck = lastSuccessfulBlockCheck;
          console.log(chalk.grey('trying with smaller step'));
        } else {
          console.log('aborting...');
          break;
        }
      }

      blockToCheck = blockToCheck - step;
      checkCount++;
    }
  });
