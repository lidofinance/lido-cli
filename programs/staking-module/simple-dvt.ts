import { provider } from '@providers';
import { getChainId, logger } from '@utils';
import { Contract, EventLog, ZeroAddress } from 'ethers';
import { lidoAddress, wstethAddress } from '@contracts';
import chalk from 'chalk';

const header = chalk.white.bold;
const checkPass = (text: string) => chalk.green.bold(text) + ' ✅';
const checkFail = (text: string) => chalk.red.bold(text) + ' ❌';
const formatCheck = (text: string, check: boolean) => (check ? checkPass(text) : checkFail(text));

const expectedStETHAddress = lidoAddress;
const expectedWstETHAddress = wstethAddress;

export const checkWrapperContract = async (wrapperAddress: string, fromBlock: number, toBlock: number) => {
  const chainId = await getChainId();

  // TODO: move to constants
  const wrapperFactoryAddresses: Record<number, Record<string, string>> = {
    1: {
      obol: '0xA9d94139A310150Ca1163b5E23f3E1dbb7D9E2A6',
      ssv: '0x3df147bd18854bfa03291034666469237504d4ca',
    },
    17000: {
      obol: '0x934ec6b68ce7cc3b3e6106c686b5ad808ed26449',
      ssv: '0xB7f465f1bd6B2f8DAbA3FcA36c5F5E49E0812F37',
    },
  };

  const factoryAddresses = wrapperFactoryAddresses[chainId];

  if (!factoryAddresses) {
    throw new Error('Unsupported chain id');
  }

  const factoryABI = ['event CreateObolLidoSplit(address split)'];
  const wrapperABI = [
    'function feeRecipient() view returns (address)',
    'function feeShare() view returns (uint256)',
    'function splitWallet() view returns (address)',
    'function stETH() view returns (address)',
    'function wstETH() view returns (address)',
  ];

  const factoryObolContract = new Contract(factoryAddresses.obol, factoryABI, provider);
  const wrapperFactorySsvContract = new Contract(factoryAddresses.ssv, factoryABI, provider);
  const wrapperContract = new Contract(wrapperAddress, wrapperABI, provider);

  const [feeRecipient, feeShare, splitWallet, stETH, wstETH] = await Promise.all([
    wrapperContract.feeRecipient(),
    wrapperContract.feeShare(),
    wrapperContract.splitWallet(),
    wrapperContract.stETH(),
    wrapperContract.wstETH(),
  ]);

  logger.log('');
  logger.log(header('Wrapper contract'));
  logger.log('');

  const obolWrapperDeployFilter = factoryObolContract.filters.CreateObolLidoSplit();
  const ssvWrapperDeployFilter = wrapperFactorySsvContract.filters.CreateObolLidoSplit();

  const deployEvents = (
    await Promise.all([
      factoryObolContract.queryFilter(obolWrapperDeployFilter, fromBlock, toBlock),
      wrapperFactorySsvContract.queryFilter(ssvWrapperDeployFilter, fromBlock, toBlock),
    ])
  )
    .flat()
    .filter((event) => event instanceof EventLog && event.args?.split === wrapperAddress);

  if (deployEvents.length == 0) throw new Error('Wrapper contract is deployed from unkown factory');
  if (deployEvents.length > 1) throw new Error('Multiple deployment events found');

  const deployEvent = deployEvents[0];
  const factoryAddress = deployEvent.address;

  const isObol = factoryAddress.toLocaleLowerCase() == factoryAddresses.obol.toLocaleLowerCase();
  const isSSV = factoryAddress.toLocaleLowerCase() == factoryAddresses.ssv.toLocaleLowerCase();
  const factoryName = isObol ? 'Obol' : isSSV ? 'SSV' : null;

  const { transactionHash } = deployEvent;

  const isStETH = stETH.toLocaleLowerCase() === expectedStETHAddress.toLocaleLowerCase();
  const isWstETH = wstETH.toLocaleLowerCase() === expectedWstETHAddress.toLocaleLowerCase();

  logger.log('Factory:        ', formatCheck(factoryName ?? 'Unknown', factoryName != null));
  logger.log('Factory address:', factoryAddress);
  logger.log('Deploy tx:      ', transactionHash);
  logger.log('Fee share:      ', Number(feeShare));
  logger.log('Fee recipient:  ', feeRecipient);
  logger.log('Split wallet:   ', splitWallet);
  logger.log('stETH address:  ', formatCheck(stETH, isStETH));
  logger.log('wstETH address: ', formatCheck(wstETH, isWstETH));

  if (!isStETH) logger.error(`stETH address mismatch: ${stETH} !== ${expectedStETHAddress}`);
  if (!isWstETH) logger.error(`wstETH address mismatch: ${wstETH} !== ${expectedWstETHAddress}`);

  return { splitWalletAddress: splitWallet };
};

export const check0xSplit = async (splitWalletAddress: string, fromBlock: number, toBlock: number) => {
  const chainId = await getChainId();

  // todo: move to constants
  const splitABI = ['function splitMain() view returns (address)'];
  const splitMainABI = [
    'function createSplit(address[] accounts,uint32[] percentAllocations,uint32 distributorFee,address controller)',
    'event CreateSplit(address indexed split)',
  ];

  const splitFactoryAddresses: Record<number, string> = {
    1: '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE',
    17000: '0x2ed6c4b5da6378c7897ac67ba9e43102feb694ee',
  };

  const factoryAddress = splitFactoryAddresses[chainId];
  if (!factoryAddress) {
    throw new Error('Unsupported chain id');
  }

  const splitContract = new Contract(splitWalletAddress, splitABI, provider);
  const splitMainAddress = await splitContract.splitMain();

  const splitMainContract = new Contract(splitMainAddress, splitMainABI, provider);
  const deployEvent = splitMainContract.filters.CreateSplit(splitWalletAddress);
  const [splitMainEvent] = await splitMainContract.queryFilter(deployEvent, fromBlock, toBlock);
  const { transactionHash } = splitMainEvent;

  const tx = await provider.getTransaction(transactionHash);
  if (!tx) throw new Error('Split deploy transaction not found');

  const parsedTx = splitMainContract.interface.parseTransaction(tx);
  if (!parsedTx) throw new Error('Split deploy transaction parse failed');

  logger.log('');
  logger.log(header('Split contract'));
  logger.log('');

  const accounts = parsedTx.args[0];
  const allocations = parsedTx.args[1].map(Number);
  const distributorFee = parsedTx.args[2];
  const controller = parsedTx.args[3];

  const expectedSplitMainAddress = factoryAddress;
  const isSplitMain = splitMainAddress.toLocaleLowerCase() === expectedSplitMainAddress.toLocaleLowerCase();
  const isZeroFee = Number(distributorFee) === 0;
  const isZeroController = controller === ZeroAddress;

  if (accounts.length !== allocations.length) {
    throw new Error('Accounts and allocations lengths mismatch');
  }

  logger.log('Deploy tx:      ', transactionHash);
  logger.log('Split wallet:   ', splitWalletAddress);
  logger.log('Split main:     ', formatCheck(splitMainAddress, isSplitMain));
  logger.log('Controller:     ', formatCheck(controller, isZeroController));
  logger.log('Distributor fee:', formatCheck(String(distributorFee), isZeroFee));

  const maxAllocation = Math.max(...allocations);
  const minAllocation = Math.min(...allocations);
  const isFairAllocation = maxAllocation - minAllocation <= 1;

  logger.log('');
  logger.log('Account                                    Share');

  parsedTx.args[0].forEach((account: string, index: number) => {
    const allocation = parsedTx.args[1][index];
    logger.log(account, formatCheck(String(allocation), isFairAllocation));
  });

  if (!isSplitMain) {
    logger.error(`splitMain address mismatch: ${splitMainAddress} !== ${expectedSplitMainAddress}`);
  }
};
