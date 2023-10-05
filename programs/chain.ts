import { program } from '@command';
import { getLatestBlock } from '@utils';

const accounts = program.command('chain').description('chain utils');

accounts
  .command('latest-block')
  .description('get latest block')
  .action(async () => {
    const block = await getLatestBlock();

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

    console.table({
      number: block.number,
      hash: block.hash,
      timestamp: block.timestamp,
      datetime: intl.format(block.timestamp * 1000),
    });
  });
