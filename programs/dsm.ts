import { program } from '../command';
import { dsmContract } from '../contracts';
import { addParsingCommands } from './common';

const dsm = program.command('dsm');
addParsingCommands(dsm, dsmContract);

dsm.command('owner').action(async () => {
  const owner = await dsmContract.getOwner();
  console.log('owner', owner);
});

dsm.command('attest-prefix').action(async () => {
  const prefix = await dsmContract.ATTEST_MESSAGE_PREFIX();
  console.log('prefix', prefix);
});

dsm.command('pause-prefix').action(async () => {
  const prefix = await dsmContract.PAUSE_MESSAGE_PREFIX();
  console.log('prefix', prefix);
});

dsm.command('max-deposits').action(async () => {
  const maxDeposits = await dsmContract.getMaxDeposits();
  console.log('max deposits', Number(maxDeposits));
});

dsm
  .command('set-max-deposits')
  .argument('<number>', 'max deposits per block')
  .action(async (maxDeposits) => {
    await dsmContract.setMaxDeposits(maxDeposits);
    console.log('value set');
  });

dsm.command('min-deposit-distance').action(async () => {
  const minDistance = await dsmContract.getMinDepositBlockDistance();
  console.log('min distance', Number(minDistance));
});

dsm
  .command('set-min-deposit-distance')
  .argument('<number>', 'min deposit block distance')
  .action(async (minDistance) => {
    await dsmContract.setMinDepositBlockDistance(minDistance);
    console.log('value set');
  });

dsm.command('pause-intent-validity-period').action(async () => {
  const period = await dsmContract.getPauseIntentValidityPeriodBlocks();
  console.log('period', Number(period));
});

dsm
  .command('set-pause-intent-validity-period')
  .argument('<number>', 'validity period blocks')
  .action(async (period) => {
    await dsmContract.setPauseIntentValidityPeriodBlocks(period);
    console.log('value set');
  });

dsm.command('quorum').action(async () => {
  const quorum = await dsmContract.getGuardianQuorum();
  console.log('quorum', Number(quorum));
});

dsm
  .command('set-quorum')
  .argument('<number>', 'new guardians quorum')
  .action(async (quorum) => {
    await dsmContract.setGuardianQuorum(quorum);
    console.log('value set');
  });

dsm.command('guardians').action(async () => {
  const guardians = await dsmContract.getGuardians();
  console.log('guardians', guardians);
});

dsm.command('can-deposit').action(async () => {
  const canDeposit = await dsmContract.canDeposit();
  console.log('can deposit', canDeposit);
});

dsm
  .command('add-guardian')
  .option('-a, --address <string>', 'guardian address')
  .option('-q, --quorum <string>', 'new quorum')
  .action(async (options) => {
    const { address, quorum } = options;
    await dsmContract.addGuardian(address, quorum);
    console.log('guardian added');
  });

dsm
  .command('remove-guardian')
  .option('-a, --address <string>', 'guardian address')
  .option('-q, --quorum <string>', 'new quorum')
  .action(async (options) => {
    const { address, quorum } = options;
    await dsmContract.removeGuardian(address, quorum);
    console.log('guardian removed');
  });
