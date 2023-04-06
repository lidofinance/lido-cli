import { authorizedCall } from '@utils';
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
    .command('set-quorum')
    .description('sets the quorum number')
    .argument('<quorum>', 'quorum number')
    .action(async (quorum) => {
      await authorizedCall(contract, 'setQuorum', [quorum]);
    });

  command
    .command('consensus-state')
    .description('returns current consensus state for member')
    .option('-a, --address <string>', 'address')
    .action(async (options) => {
      const { address } = options;
      const state = await contract.getConsensusStateForMember(address);
      console.log('state', state.toObject());
    });

  command
    .command('add-member')
    .description('adds new member and sets the quorum')
    .option('-a, --address <string>', 'address')
    .option('-q, --quorum <string>', 'quorum')
    .action(async (options) => {
      const { address, quorum } = options;
      await authorizedCall(contract, 'addMember', [address, quorum]);
    });

  command
    .command('remove-member')
    .description('removes the member and sets the quorum')
    .option('-a, --address <string>', 'address')
    .option('-q, --quorum <string>', 'quorum')
    .action(async (options) => {
      const { address, quorum } = options;
      await authorizedCall(contract, 'removeMember', [address, quorum]);
    });

  command
    .command('current-frame')
    .description('returns the current frame')
    .action(async () => {
      const frame = await contract.getCurrentFrame();
      console.log('frame', frame.toObject());
    });

  command
    .command('chain-config')
    .description('returns the chain config')
    .action(async () => {
      const config = await contract.getChainConfig();
      console.log('config', config.toObject());
    });

  command
    .command('frame-config')
    .description('returns the frame config')
    .action(async () => {
      const config = await contract.getFrameConfig();
      console.log('config', config.toObject());
    });

  command
    .command('set-frame-config')
    .description('sets the frame config')
    .option('-e, --epochs-per-frame <number>', 'epochs per frame')
    .option('-f, --fastlane <string>', 'fastlane length slots')
    .action(async (options) => {
      const { epochsPerFrame, fastlane } = options;
      await authorizedCall(contract, 'setFrameConfig', [epochsPerFrame, fastlane]);
    });

  command
    .command('update-initial-epoch')
    .description('updates the initial epoch')
    .argument('<epoch>', 'initial epoch')
    .action(async (epoch) => {
      await authorizedCall(contract, 'updateInitialEpoch', [Number(epoch)]);
    });

  command
    .command('get-member-state')
    .description('sets the frame config')
    .argument('<address>', 'member address')
    .action(async (address) => {
      const state = await contract.getConsensusStateForMember(address);
      console.log('member state', state);
    });

  command
    .command('set-report-processor')
    .description('sets the report processor')
    .argument('<address>', 'processor address')
    .action(async (address) => {
      await authorizedCall(contract, 'setReportProcessor', [address]);
    });
};
