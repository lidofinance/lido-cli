import { program } from '@command';
import { lidoAddress, simpleDVTContract, wstethAddress } from '@contracts';
import { addAragonAppSubCommands, addCuratedModuleSubCommands, addLogsCommands, addParsingCommands } from './common';
import { provider } from '@providers';
import { Contract } from 'ethers';
import { logger } from '@utils';

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
  .action(async (wrapperAddress) => {
    // wrapper checks

    const wrapperABI = [
      'function feeRecipient() view returns (address)',
      'function feeShare() view returns (uint256)',
      'function splitWallet() view returns (address)',
      'function stETH() view returns (address)',
      'function wstETH() view returns (address)',
    ];

    const wrapperContract = new Contract(wrapperAddress, wrapperABI, provider);

    const [feeRecipient, feeShare, splitWallet, stETH, wstETH] = await Promise.all([
      wrapperContract.feeRecipient(),
      wrapperContract.feeShare(),
      wrapperContract.splitWallet(),
      wrapperContract.stETH(),
      wrapperContract.wstETH(),
    ]);

    logger.log('Wrapper contract info:');
    logger.table({
      feeShare: Number(feeShare),
      feeRecipient,
      splitWallet,
      stETH,
      wstETH,
    });

    // 0x splitter checks

    const splitABI = ['function splitMain() view returns (address)'];
    const splitMainABI = [
      'function createSplit(address[] accounts,uint32[] percentAllocations,uint32 distributorFee,address controller)',
      'event CreateSplit(address indexed split)',
    ];

    const splitContract = new Contract(splitWallet, splitABI, provider);
    const splitMainAddress = await splitContract.splitMain();

    const splitMainContract = new Contract(splitMainAddress, splitMainABI, provider);
    const deployEvent = splitMainContract.filters.CreateSplit(splitWallet);
    const toBlock = await provider.getBlockNumber();
    const [splitMainEvent] = await splitMainContract.queryFilter(deployEvent, 0, toBlock);
    const { transactionHash } = splitMainEvent;

    const tx = await provider.getTransaction(transactionHash);

    if (!tx) {
      logger.error('Transaction not found');
      return;
    }

    const parsedTx = splitMainContract.interface.parseTransaction(tx);

    if (!parsedTx) {
      logger.error('Transaction parse failed');
      return;
    }

    logger.log('');
    logger.log('Split contract info:');
    logger.log('Accounts:');
    logger.table(parsedTx.args[0]);
    logger.log('Percent allocations:');
    logger.table(parsedTx.args[1]);

    logger.log('Common info:');
    logger.table({
      transactionHash,
      splitMainAddress,
      splitWallet,
      distributorFee: parsedTx.args[2],
      controller: parsedTx.args[3],
    });

    // addresses checks

    const splitFactoryAddresses: Record<number, string> = {
      1: '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE',
      17000: '0x2ed6c4b5da6378c7897ac67ba9e43102feb694ee',
    };

    const { chainId } = await provider.getNetwork();
    const expectedSplitMainAddress = splitFactoryAddresses[Number(chainId)];

    logger.log('Addresses checks:');

    const expectedStETHAddress = lidoAddress;
    const expectedWstETHAddress = wstethAddress;

    if (stETH.toLocaleLowerCase() === expectedStETHAddress.toLocaleLowerCase()) {
      logger.success('stETH address matches');
    } else {
      logger.error(`stETH address mismatch: ${stETH} !== ${expectedStETHAddress}`);
    }

    if (wstETH.toLocaleLowerCase() === expectedWstETHAddress.toLocaleLowerCase()) {
      logger.success('wstETH address matches');
    } else {
      logger.error(`wstETH address mismatch: ${wstETH} !== ${expectedWstETHAddress}`);
    }

    if (splitMainAddress.toLocaleLowerCase() === expectedSplitMainAddress.toLocaleLowerCase()) {
      logger.success('splitMain address matches');
    } else {
      logger.error(`splitMain address mismatch: ${splitMainAddress} !== ${expectedSplitMainAddress}`);
    }
  });
