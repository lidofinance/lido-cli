import { program } from '../command';
import { consensusForAccountingContract } from '../contracts';
import { addAccessControlSubCommands } from './common';

const oracle = program.command('accounting-consensus');
addAccessControlSubCommands(oracle, consensusForAccountingContract);

oracle.command('members').action(async () => {
  const [addresses, lastReportedSlots] = await consensusForAccountingContract.getMembers();

  console.log('addresses', [...addresses]);
  console.log('last reported slots', [...lastReportedSlots]);
});

oracle.command('quorum').action(async () => {
  const quorum = await consensusForAccountingContract.getQuorum();
  console.log('quorum', Number(quorum));
});

oracle
  .command('consensus-state')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { address } = options;
    const state = await consensusForAccountingContract.getConsensusStateForMember(address);
    console.log('state', state);
  });

oracle
  .command('add-member')
  .option('-a, --address <string>', 'address')
  .option('-q, --quorum <string>', 'quorum')
  .action(async (options) => {
    const { address, quorum } = options;
    await consensusForAccountingContract.addMember(address, quorum);
  });

oracle
  .command('remove-member')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { address } = options;
    await consensusForAccountingContract.removeMember(address);
  });

oracle
  .command('frame-config')
  .option('-e, --epochs-per-frame <number>', 'epochs per frame')
  .option('-f, --fastlane <string>', 'fastlane length slots')
  .action(async (options) => {
    const { epochsPerFrame, fastlane } = options;
    await consensusForAccountingContract.setFrameConfig(epochsPerFrame, fastlane);
  });
