import { program } from '@command';
import { dsmContract } from '@contracts';
import { authorizedCall } from '@utils';
import { addLogsCommands, addParsingCommands } from './common';

const dsm = program.command('dsm').description('interact with deposit security module contract');
addParsingCommands(dsm, dsmContract);
addLogsCommands(dsm, dsmContract);

dsm
  .command('owner')
  .description('returns the owner of the contract')
  .action(async () => {
    const owner = await dsmContract.getOwner();
    console.log('owner', owner);
  });

dsm
  .command('attest-prefix')
  .description('returns the attest prefix for a message')
  .action(async () => {
    const prefix = await dsmContract.ATTEST_MESSAGE_PREFIX();
    console.log('prefix', prefix);
  });

dsm
  .command('pause-prefix')
  .description('returns the pause prefix for a message')
  .action(async () => {
    const prefix = await dsmContract.PAUSE_MESSAGE_PREFIX();
    console.log('prefix', prefix);
  });

dsm
  .command('max-deposits')
  .description('returns the max amount of deposits per transaction')
  .action(async () => {
    const maxDeposits = await dsmContract.getMaxDeposits();
    console.log('max deposits', Number(maxDeposits));
  });

dsm
  .command('set-max-deposits')
  .description('sets the max amount of deposits per transaction')
  .argument('<deposits>', 'max deposits per block')
  .action(async (maxDeposits) => {
    await authorizedCall(dsmContract, 'setMaxDeposits', [maxDeposits]);
  });

dsm
  .command('min-deposit-distance')
  .description('returns the min deposits distance in blocks')
  .action(async () => {
    const minDistance = await dsmContract.getMinDepositBlockDistance();
    console.log('min distance', Number(minDistance));
  });

dsm
  .command('set-min-deposit-distance')
  .description('sets the min deposits distance in blocks')
  .argument('<distance>', 'min deposit block distance')
  .action(async (distance) => {
    await authorizedCall(dsmContract, 'setMinDepositBlockDistance', [distance]);
  });

dsm
  .command('pause-intent-validity-period')
  .description('returns pause message validity period in blocks')
  .action(async () => {
    const period = await dsmContract.getPauseIntentValidityPeriodBlocks();
    console.log('period', Number(period));
  });

dsm
  .command('set-pause-intent-validity-period')
  .description('sets pause message validity period in blocks')
  .argument('<period>', 'validity period blocks')
  .action(async (period) => {
    await authorizedCall(dsmContract, 'setPauseIntentValidityPeriodBlocks', [period]);
  });

dsm
  .command('quorum')
  .description('returns the guardians quorum')
  .action(async () => {
    const quorum = await dsmContract.getGuardianQuorum();
    console.log('quorum', Number(quorum));
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
    console.log('guardians', guardians);
  });

dsm
  .command('can-deposit')
  .argument('<moduleId>', 'staking module id')
  .description('returns is deposits available')
  .action(async (moduleId) => {
    const canDeposit = await dsmContract.canDeposit(moduleId);
    console.log('can deposit', canDeposit);
  });

dsm
  .command('add-guardian')
  .description('adds the new guardian and sets the quorum')
  .argument('<address>', 'guardian address')
  .argument('<quorum>', 'new quorum')
  .action(async (address, quorum) => {
    await authorizedCall(dsmContract, 'addGuardian', [address, quorum]);
  });

dsm
  .command('remove-guardian')
  .description('removes the guardian and sets the quorum')
  .option('-a, --address <string>', 'guardian address')
  .option('-q, --quorum <string>', 'new quorum')
  .action(async (options) => {
    const { address, quorum } = options;
    await authorizedCall(dsmContract, 'removeGuardian', [address, quorum]);
  });
