import { program } from '@command';
import { dsmContract } from '@contracts';
import { authorizedCall, logger } from '@utils';
import { addLogsCommands, addParsingCommands } from './common';
import { ZeroHash } from 'ethers';

const dsm = program.command('dsm').description('interact with deposit security module contract');
addParsingCommands(dsm, dsmContract);
addLogsCommands(dsm, dsmContract);

dsm
  .command('lido')
  .description('returns the lido contract address')
  .action(async () => {
    const address = await dsmContract.LIDO();
    logger.log('Address', address);
  });

dsm
  .command('staking-router')
  .description('returns the staking router contract address')
  .action(async () => {
    const address = await dsmContract.STAKING_ROUTER();
    logger.log('Address', address);
  });

dsm
  .command('deposit-contract')
  .description('returns the deposit contract address')
  .action(async () => {
    const address = await dsmContract.DEPOSIT_CONTRACT();
    logger.log('Address', address);
  });

dsm
  .command('attest-prefix')
  .description('returns the attest prefix for a message')
  .action(async () => {
    const prefix = await dsmContract.ATTEST_MESSAGE_PREFIX();
    logger.log('Prefix', prefix);
  });

dsm
  .command('pause-prefix')
  .description('returns the pause prefix for a message')
  .action(async () => {
    const prefix = await dsmContract.PAUSE_MESSAGE_PREFIX();
    logger.log('Prefix', prefix);
  });

dsm
  .command('unvet-prefix')
  .description('returns the unvet prefix for a message')
  .action(async () => {
    const prefix = await dsmContract.UNVET_MESSAGE_PREFIX();
    logger.log('Prefix', prefix);
  });

dsm
  .command('owner')
  .description('returns the owner of the contract')
  .action(async () => {
    const owner = await dsmContract.getOwner();
    logger.log('Owner', owner);
  });

dsm
  .command('set-owner')
  .description('sets the owner of the contract')
  .argument('<owner>', 'new owner address')
  .action(async (owner) => {
    await authorizedCall(dsmContract, 'setOwner', [owner]);
  });

dsm
  .command('pause-intent-validity-period')
  .description('returns pause message validity period in blocks')
  .action(async () => {
    const period = await dsmContract.getPauseIntentValidityPeriodBlocks();
    logger.log('Period', Number(period));
  });

dsm
  .command('set-pause-intent-validity-period')
  .description('sets pause message validity period in blocks')
  .argument('<period>', 'validity period blocks')
  .action(async (period) => {
    await authorizedCall(dsmContract, 'setPauseIntentValidityPeriodBlocks', [period]);
  });

dsm
  .command('max-operators-per-unvetting')
  .description('returns the max operators per unvetting')
  .action(async () => {
    const operators = await dsmContract.getMaxOperatorsPerUnvetting();
    logger.log('Max operators per unvetting', Number(operators));
  });

dsm
  .command('set-max-operators-per-unvetting')
  .description('sets the max operators per unvetting')
  .argument('<operators>', 'max operators per unvetting')
  .action(async (operators) => {
    await authorizedCall(dsmContract, 'setMaxOperatorsPerUnvetting', [operators]);
  });

dsm
  .command('quorum')
  .description('returns the guardians quorum')
  .action(async () => {
    const quorum = await dsmContract.getGuardianQuorum();
    logger.log('Quorum', Number(quorum));
  });

dsm
  .command('set-quorum')
  .description('sets the guardians quorum')
  .argument('<quorum>', 'new guardians quorum')
  .action(async (quorum) => {
    await authorizedCall(dsmContract, 'setGuardianQuorum', [quorum]);
  });

dsm
  .command('guardians')
  .description('returns the list of guardians')
  .action(async () => {
    const guardians = await dsmContract.getGuardians();
    logger.log('Guardians', guardians.toArray());
  });

dsm
  .command('is-guardian')
  .argument('<address>', 'guardian address')
  .description('returns is guardian')
  .action(async (address) => {
    const isGuardian = await dsmContract.isGuardian(address);
    logger.log('Is guardian', isGuardian);
  });

dsm
  .command('guardian-index')
  .argument('<address>', 'guardian address')
  .description('returns guardian index')
  .action(async (address) => {
    const index = await dsmContract.getGuardianIndex(address);
    logger.log('Guardian index', Number(index));
  });

dsm
  .command('add-guardian')
  .aliases(['add'])
  .description('adds the new guardian and sets the quorum')
  .argument('<address>', 'guardian address')
  .argument('<quorum>', 'new quorum')
  .action(async (address, quorum) => {
    await authorizedCall(dsmContract, 'addGuardian', [address, quorum]);
  });

dsm
  .command('add-guardians')
  .aliases(['add-many'])
  .description('adds the new guardians and sets the quorum')
  .argument('<addresses>', 'guardian addresses separated by comma')
  .argument('<quorum>', 'new quorum')
  .action(async (addresses, quorum) => {
    const guardians = addresses.split(',').map((address: string) => address.trim());
    await authorizedCall(dsmContract, 'addGuardians', [guardians, quorum]);
  });

dsm
  .command('remove-guardian')
  .aliases(['remove'])
  .description('removes the guardian and sets the quorum')
  .argument('<address>', 'guardian address')
  .argument('<quorum>', 'new quorum')
  .action(async (options) => {
    const { address, quorum } = options;
    await authorizedCall(dsmContract, 'removeGuardian', [address, quorum]);
  });

dsm
  .command('is-deposits-paused')
  .aliases(['is-paused', 'paused'])
  .description('returns is deposits paused')
  .action(async () => {
    const isDepositsPaused = await dsmContract.isDepositsPaused();
    logger.log('Deposits paused', isDepositsPaused);
  });

dsm
  .command('pause-deposits')
  .aliases(['pause'])
  .description('pauses deposits')
  .argument('<blockNumber>', 'block number')
  .option('-r, --signature-r <string>', 'signature r', ZeroHash)
  .option('-vs, --signature-vs <string>', 'signature vs', ZeroHash)
  .action(async (blockNumber, options) => {
    const { r, vs } = options;
    await authorizedCall(dsmContract, 'pauseDeposits', [blockNumber, { r, vs }]);
  });

dsm
  .command('unpause-deposits')
  .aliases(['unpause'])
  .description('unpauses deposits')
  .action(async () => {
    await authorizedCall(dsmContract, 'unpauseDeposits', []);
  });

dsm
  .command('can-deposit')
  .argument('<moduleId>', 'staking module id')
  .description('returns is deposits available')
  .action(async (moduleId) => {
    const canDeposit = await dsmContract.canDeposit(Number(moduleId));
    logger.log('Can deposit', canDeposit);
  });

dsm
  .command('last-deposit-block')
  .description('returns the last deposit block')
  .action(async () => {
    const block = await dsmContract.getLastDepositBlock();
    logger.log('Last deposit block', Number(block));
  });

dsm
  .command('is-min-deposit-distance-passed')
  .aliases(['min-deposit-distance-passed'])
  .description('returns is min deposit distance passed')
  .action(async () => {
    const isMinDepositDistancePassed = await dsmContract.isMinDepositDistancePassed();
    logger.log('Is min deposit distance passed', isMinDepositDistancePassed);
  });

dsm
  .command('deposit-buffered-ether')
  .description('deposits buffered ether')
  .argument('<blockNumber>', 'block number')
  .argument('<blockHash>', 'block hash')
  .argument('<depositRoot>', 'deposit root of the deposit contract')
  .argument('<stakingModuleId>', 'staking module id')
  .argument('<nonce>', 'staking module nonce')
  .argument('<signatures>', 'guardian signatures')
  .action(async () => {
    // TODO: implement
    throw new Error('Not implemented');
  });

dsm
  .command('unvet-signing-keys')
  .description('unvet signing keys')
  .argument('<blockNumber>', 'block number')
  .argument('<blockHash>', 'block hash')
  .argument('<stakingModuleId>', 'staking module id')
  .argument('<nonce>', 'staking module nonce')
  .argument('<operatorIds>', 'operator ids separated by comma')
  .argument('<vettedSigningKeysCounts>', 'new vetted signing keys counts')
  .option('-r, --signature-r <string>', 'signature r', ZeroHash)
  .option('-vs, --signature-vs <string>', 'signature vs', ZeroHash)
  .action(async () => {
    // TODO: implement
    throw new Error('Not implemented');
  });
