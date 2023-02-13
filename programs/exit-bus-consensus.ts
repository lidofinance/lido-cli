import { program } from '../command';
import { consensusForExitBusContract } from '../contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const oracle = program.command('exit-bus-consensus');
addAccessControlSubCommands(oracle, consensusForExitBusContract);
addParsingCommands(oracle, consensusForExitBusContract);

oracle.command('members').action(async () => {
  const [addresses, lastReportedSlots] = await consensusForExitBusContract.getMembers();

  console.log('addresses', [...addresses]);
  console.log('last reported slots', [...lastReportedSlots]);
});

oracle.command('quorum').action(async () => {
  const quorum = await consensusForExitBusContract.getQuorum();
  console.log('quorum', Number(quorum));
});

oracle
  .command('add-member')
  .option('-a, --address <string>', 'address')
  .option('-q, --quorum <string>', 'quorum')
  .action(async (options) => {
    const { address, quorum } = options;
    await consensusForExitBusContract.addMember(address, quorum);
  });

oracle
  .command('remove-member')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { address } = options;
    await consensusForExitBusContract.removeMember(address);
  });

oracle
  .command('frame-config')
  .option('-e, --epochs-per-frame <number>', 'epochs per frame')
  .option('-f, --fastlane <string>', 'fastlane length slots')
  .action(async (options) => {
    const { epochsPerFrame, fastlane } = options;
    await consensusForExitBusContract.setFrameConfig(epochsPerFrame, fastlane);
  });
