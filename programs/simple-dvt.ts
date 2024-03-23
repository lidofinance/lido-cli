import { program } from '@command';
import { simpleDVTContract } from '@contracts';
import { addAragonAppSubCommands, addCuratedModuleSubCommands, addLogsCommands, addParsingCommands } from './common';
import { getLatestBlock, logger } from '@utils';
import { check0xSplit, checkWrapperContract } from './staking-module';

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
  .argument('<address>', 'address of the reward address')
  .option('-b, --blocks <number>', 'blocks', '1000000000')
  .action(async (wrapperAddress, { blocks }) => {
    const latestBlock = await getLatestBlock();
    const toBlock = latestBlock.number;
    const fromBlock = Math.max(toBlock - Number(blocks), 0);

    const { splitWalletAddress } = await checkWrapperContract(wrapperAddress, fromBlock, toBlock);
    logger.log('');
    await check0xSplit(splitWalletAddress, fromBlock, toBlock);
  });
