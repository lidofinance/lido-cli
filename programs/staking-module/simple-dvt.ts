import { provider } from '@providers';
import { logger } from '@utils';
import { Contract, EventLog, ZeroAddress } from 'ethers';
import {
  lidoAddress,
  wstethAddress,
  obolLidoSplitAbi,
  obolLidoSplitFactoryObolContract,
  obolLidoSplitFactorySSVContract,
  obolLidoSplitFactoryObolAddress,
  obolLidoSplitFactorySSVAddress,
  splitWalletAbi,
  splitMainContract,
  splitMainAddress,
  gnosisSafeAbi,
  gnosisSafeProxyFactoryContract,
} from '@contracts';
import chalk from 'chalk';
import Table from 'cli-table3';

const header = chalk.white.bold;

const ok = chalk.green.bold;
const warn = chalk.yellow.bold;

const checkPass = (text: string) => chalk.green.bold(text) + ' ✅';
const checkFail = (text: string) => chalk.red.bold(text) + ' ❌';
const checkWarn = (text: string) => chalk.yellow.bold(text);
const passOrFail = (text: string, check: boolean) => (check ? checkPass(text) : checkFail(text));
const passOrWarn = (text: string, check: boolean) => (check ? checkPass(text) : checkWarn(text));

const expectedStETHAddress = lidoAddress;
const expectedWstETHAddress = wstethAddress;
const expectedSplitMainAddress = splitMainAddress;

const intl = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 5, maximumFractionDigits: 5 });

const formatETH = (wei: bigint) => {
  return intl.format(Number(wei) / 1e18);
};

const getFormattedAccountInfo = async (account: string) => {
  const [txCount, balance] = await Promise.all([
    provider.getTransactionCount(account, 'latest'),
    provider.getBalance(account),
  ]);

  const balanceEth = formatETH(balance);
  const txCountFormatted = txCount > 0 ? ok(txCount) : warn(txCount);
  const balanceFormatted = balance > 0 ? ok(balanceEth) : warn(balanceEth);

  return {
    nonce: txCountFormatted,
    balance: balanceFormatted,
  };
};

export const checkWrapperContract = async (wrapperAddress: string, fromBlock: number, toBlock: number) => {
  const wrapperContract = new Contract(wrapperAddress, obolLidoSplitAbi, provider);

  const obolFactoryContract = obolLidoSplitFactoryObolContract;
  const ssvFactoryContract = obolLidoSplitFactorySSVContract;
  const obolFactoryAddress = obolLidoSplitFactoryObolAddress;
  const ssvFactoryAddress = obolLidoSplitFactorySSVAddress;

  const [feeRecipient, feeShare, splitWallet, stETH, wstETH] = await Promise.all([
    wrapperContract.feeRecipient(),
    wrapperContract.feeShare(),
    wrapperContract.splitWallet(),
    wrapperContract.stETH(),
    wrapperContract.wstETH(),
  ]);

  const obolWrapperDeployFilter = obolFactoryContract.filters.CreateObolLidoSplit();
  const ssvWrapperDeployFilter = ssvFactoryContract.filters.CreateObolLidoSplit();

  const deployEvents = (
    await Promise.all([
      obolFactoryContract.queryFilter(obolWrapperDeployFilter, fromBlock, toBlock),
      ssvFactoryContract.queryFilter(ssvWrapperDeployFilter, fromBlock, toBlock),
    ])
  )
    .flat()
    .filter((event) => event instanceof EventLog && event.args?.split === wrapperAddress);

  if (deployEvents.length == 0) throw new Error('Wrapper contract is deployed from unkown factory');
  if (deployEvents.length > 1) throw new Error('Multiple deployment events found');

  const deployEvent = deployEvents[0];
  const factoryAddress = deployEvent.address;

  const isObol = factoryAddress.toLocaleLowerCase() == obolFactoryAddress.toLocaleLowerCase();
  const isSSV = factoryAddress.toLocaleLowerCase() == ssvFactoryAddress.toLocaleLowerCase();
  const factoryName = isObol ? 'Obol' : isSSV ? 'SSV' : null;

  const { transactionHash } = deployEvent;

  const isStETH = stETH.toLocaleLowerCase() === expectedStETHAddress.toLocaleLowerCase();
  const isWstETH = wstETH.toLocaleLowerCase() === expectedWstETHAddress.toLocaleLowerCase();

  logger.log('');
  logger.log(header('Wrapper contract'));
  logger.log('');

  logger.log('Factory:        ', passOrFail(factoryName ?? 'Unknown', factoryName != null));
  logger.log('Factory address:', factoryAddress);
  logger.log('Deploy tx:      ', transactionHash);
  logger.log('Fee share:      ', Number(feeShare));
  logger.log('Fee recipient:  ', feeRecipient);
  logger.log('Split wallet:   ', splitWallet);
  logger.log('stETH address:  ', passOrFail(stETH, isStETH));
  logger.log('wstETH address: ', passOrFail(wstETH, isWstETH));
  logger.log('');

  return { splitWalletAddress: splitWallet };
};

export const check0xSplit = async (splitWalletAddress: string, fromBlock: number, toBlock: number) => {
  const splitContract = new Contract(splitWalletAddress, splitWalletAbi, provider);
  const splitMainAddress = await splitContract.splitMain();

  const deployEvent = splitMainContract.filters.CreateSplit(splitWalletAddress);
  const [splitMainEvent] = await splitMainContract.queryFilter(deployEvent, fromBlock, toBlock);
  const { transactionHash } = splitMainEvent;

  const tx = await provider.getTransaction(transactionHash);
  if (!tx) throw new Error('Split deploy transaction not found');

  const parsedTx = splitMainContract.interface.parseTransaction(tx);
  if (!parsedTx) throw new Error('Split deploy transaction parse failed');

  const accounts = (parsedTx.args[0] as unknown[]).map(String);
  const allocations = (parsedTx.args[1] as unknown[]).map(Number);
  const distributorFee = Number(parsedTx.args[2]);
  const controller = String(parsedTx.args[3]);

  const isSplitMain = splitMainAddress.toLocaleLowerCase() === expectedSplitMainAddress.toLocaleLowerCase();
  const isZeroFee = distributorFee === 0;
  const isZeroController = controller === ZeroAddress;

  if (accounts.length !== allocations.length) throw new Error('Accounts and allocations lengths mismatch');

  logger.log('');
  logger.log(header('Split contract'));
  logger.log('');

  logger.log('Deploy tx:      ', transactionHash);
  logger.log('Split wallet:   ', splitWalletAddress);
  logger.log('Split main:     ', passOrFail(splitMainAddress, isSplitMain));
  logger.log('Controller:     ', passOrFail(controller, isZeroController));
  logger.log('Distributor fee:', passOrFail(String(distributorFee), isZeroFee));

  const maxAllocation = Math.max(...allocations);
  const minAllocation = Math.min(...allocations);
  const isFairAllocation = maxAllocation - minAllocation <= 1;

  const accountsTable = new Table({
    head: ['Account', 'Share', 'Nonce', 'Balance'],
    colAligns: ['left', 'right', 'right', 'right'],
    style: { head: ['gray'], compact: true },
  });

  accountsTable.push(
    ...(await Promise.all(
      accounts.map(async (account, index) => {
        const share = passOrFail(String(allocations[index]), isFairAllocation);
        const { nonce, balance } = await getFormattedAccountInfo(account);
        return [account, share, nonce, balance];
      }),
    )),
  );

  logger.log('');
  logger.log(accountsTable.toString());
  logger.log('');

  return { splitWalletAccounts: accounts };
};

export const checkGnosisSafe = async (safeAddress: string, splitAccounts: string[]) => {
  const expectedGnosisVersion = '1.3.0';
  const expectedMinThreshold = Math.floor(splitAccounts.length / 2) + 1;

  const safeContract = new Contract(safeAddress, gnosisSafeAbi, provider);

  const [gnosisOwners, version, threshold, referrenceCode, deployedCode] = await Promise.all([
    safeContract.getOwners(),
    safeContract.VERSION(),
    safeContract.getThreshold(),
    gnosisSafeProxyFactoryContract.proxyRuntimeCode(),
    safeContract.getDeployedCode(),
  ]);

  const sortedSplitAccounts = splitAccounts.map((owner) => owner.toLocaleLowerCase()).sort();
  const sortedGnosisOwners: string[] = gnosisOwners.map((owner: string) => owner.toLocaleLowerCase()).sort();
  const isAmountMatch = gnosisOwners.length === splitAccounts.length;
  const isOwnersMatch = JSON.stringify(sortedGnosisOwners) === JSON.stringify(sortedSplitAccounts);
  const isCodeMatch = deployedCode === referrenceCode;
  const isExpectedVersion = version === expectedGnosisVersion;
  const isExpectedThreshold = threshold >= expectedMinThreshold;

  logger.log('');
  logger.log(header('GnosisSafe contract'));
  logger.log('');

  logger.log('Threshold:      ', passOrFail(threshold, isExpectedThreshold));
  logger.log('MS version:     ', passOrFail(version, isExpectedVersion));
  logger.log('MS bytecode:    ', passOrFail(`${isCodeMatch ? '' : 'do not '}match GnosisProxy`, isCodeMatch));
  logger.log('Owners amount:  ', passOrFail(`${isAmountMatch ? '' : 'do not '}match Split`, isAmountMatch));
  logger.log('Owners:         ', passOrWarn(`${isOwnersMatch ? '' : 'do not '}match Split`, isOwnersMatch));

  const ownersTable = new Table({
    head: ['Account', 'In split', 'Nonce', 'Balance'],
    colAligns: ['left', 'right', 'right', 'right'],
    style: { head: ['gray'], compact: true },
  });

  ownersTable.push(
    ...(await Promise.all(
      sortedGnosisOwners.map(async (account) => {
        const isInSplit = sortedSplitAccounts.includes(account) ? ok('yes') : warn('no');
        const { nonce, balance } = await getFormattedAccountInfo(account);
        return [account, isInSplit, nonce, balance];
      }),
    )),
  );

  logger.log('');
  logger.log(ownersTable.toString());
  logger.log('');
};
