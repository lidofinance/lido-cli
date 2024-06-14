import { program } from '@command';
import { simpleDVTContract } from '@contracts';
import { addAragonAppSubCommands, addCuratedModuleSubCommands, addLogsCommands, addParsingCommands } from './common';
import { getLatestBlockRange } from '@utils';
import { check0xSplit, checkGnosisSafe, checkSignatures, checkWrapperContract } from './staking-module';

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
  .argument('<reward-address>', 'cluster reward address')
  .option('-b, --blocks <number>', 'blocks', '1000000000')
  .action(async (rewardAddress, { blocks }) => {
    const [fromBlock, toBlock] = await getLatestBlockRange(blocks);

    const { splitWalletAddress } = await checkWrapperContract(rewardAddress, fromBlock, toBlock);
    await check0xSplit(splitWalletAddress, fromBlock, toBlock);
  });

simpleDVT
  .command('check-cluster-addresses')
  .description('check split contracts')
  .argument('<reward-address>', 'cluster reward address')
  .argument('<manager-address>', 'cluster manager address')
  .option('-b, --blocks <number>', 'blocks', '1000000000')
  .action(async (rewardAddress, managerAddress, { blocks }) => {
    const [fromBlock, toBlock] = await getLatestBlockRange(blocks);

    const { splitWalletAddress } = await checkWrapperContract(rewardAddress, fromBlock, toBlock);
    const { splitWalletAccounts } = await check0xSplit(splitWalletAddress, fromBlock, toBlock);

    await checkGnosisSafe(managerAddress, splitWalletAccounts);
  });

simpleDVT
  .command('check-cluster')
  .description('check split contracts')
  .argument('<cluster-name>', 'cluster name')
  .argument('<reward-address>', 'cluster reward address')
  .argument('<manager-address>', 'cluster manager address')
  .option('-b, --blocks <number>', 'blocks', '1000000000')
  .action(async (clusterName, rewardAddress, managerAddress, { blocks }) => {
    const [fromBlock, toBlock] = await getLatestBlockRange(blocks);

    const { splitWalletAddress } = await checkWrapperContract(rewardAddress, fromBlock, toBlock);
    const { splitWalletAccounts } = await check0xSplit(splitWalletAddress, fromBlock, toBlock);
    const { gnosisOwners } = await checkGnosisSafe(managerAddress, splitWalletAccounts);

    await checkSignatures(clusterName, gnosisOwners);
  });
