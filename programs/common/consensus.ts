import { Command } from 'commander';
import { Contract } from 'ethers';

export const addConsensusCommands = (command: Command, contract: Contract) => {
  command
    .command('members')
    .description('returns a list of oracle members')
    .action(async () => {
      const [addresses, lastReportedSlots] = await contract.getMembers();

      console.log('addresses', [...addresses]);
      console.log('last reported slots', [...lastReportedSlots]);
    });

  command
    .command('quorum')
    .description('returns the quorum number')
    .action(async () => {
      const quorum = await contract.getQuorum();
      console.log('quorum', Number(quorum));
    });

  command
    .command('consensus-state')
    .description('returns current consensus state for member')
    .option('-a, --address <string>', 'address')
    .action(async (options) => {
      const { address } = options;
      const state = await contract.getConsensusStateForMember(address);
      console.log('state', state);
    });

  command
    .command('add-member')
    .description('adds new member and sets the quorum')
    .option('-a, --address <string>', 'address')
    .option('-q, --quorum <string>', 'quorum')
    .action(async (options) => {
      const { address, quorum } = options;
      await contract.addMember(address, quorum);
      console.log('member added');
    });

  command
    .command('remove-member')
    .description('removes the member and sets the quorum')
    .option('-a, --address <string>', 'address')
    .option('-q, --quorum <string>', 'quorum')
    .action(async (options) => {
      const { address, quorum } = options;
      await contract.removeMember(address, quorum);
      console.log('member removed');
    });

  command
    .command('current-frame')
    .description('returns the current frame')
    .action(async () => {
      const { refSlot, reportProcessingDeadlineSlot } = await contract.getCurrentFrame();
      console.log('frame', { refSlot, reportProcessingDeadlineSlot });
    });

  command
    .command('chain-config')
    .description('returns the chain config')
    .action(async () => {
      const { slotsPerEpoch, secondsPerSlot, genesisTime } = await contract.getChainConfig();
      console.log('config', { slotsPerEpoch, secondsPerSlot, genesisTime });
    });

  command
    .command('frame-config')
    .description('returns the frame config')
    .action(async () => {
      const { initialEpoch, epochsPerFrame, fastLaneLengthSlots } = await contract.getFrameConfig();
      console.log('config', { initialEpoch, epochsPerFrame, fastLaneLengthSlots });
    });

  command
    .command('set-frame-config')
    .description('sets the frame config')
    .option('-e, --epochs-per-frame <number>', 'epochs per frame')
    .option('-f, --fastlane <string>', 'fastlane length slots')
    .action(async (options) => {
      const { epochsPerFrame, fastlane } = options;
      await contract.setFrameConfig(epochsPerFrame, fastlane);
      console.log('frame config set');
    });

  command
    .command('get-member-state')
    .description('sets the frame config')
    .argument('<address>', 'member address')
    .action(async (address) => {
      const state = await contract.getConsensusStateForMember(address, { blockTag: 157214 });
      console.log('member state', state);
    });
};
