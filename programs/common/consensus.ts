import { authorizedCall } from '@utils';
import { Command } from 'commander';
import { Contract, formatEther } from 'ethers';

export const addConsensusCommands = (command: Command, contract: Contract) => {
  command
    .command('members')
    .description('returns a list of oracle members')
    .action(async () => {
      const [addresses, lastReportedSlots]: [string[], bigint[]] = await contract.getMembers();

      const table = await Promise.all(
        addresses.map(async (address, index) => {
          const lastReportedSlot = Number(lastReportedSlots[index]);
          const balanceBigint = (await contract.runner?.provider?.getBalance(address)) || 0;
          const balance = formatEther(balanceBigint);

          return {
            address,
            lastReportedSlot,
            balance,
          };
        }),
      );

      console.table(table.sort((a, b) => b.lastReportedSlot - a.lastReportedSlot));
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

  command
    .command('closest-report')
    .description('returns the closest report')
    .action(async () => {
      const chainConfig = await contract.getChainConfig();
      const frameConfig = await contract.getFrameConfig();

      const secondsPerSlot = Number(chainConfig.secondsPerSlot);
      const genesisTime = Number(chainConfig.genesisTime);
      const slotsPerEpoch = Number(chainConfig.slotsPerEpoch);

      const initialEpoch = Number(frameConfig.initialEpoch);
      const epochsPerFrame = Number(frameConfig.epochsPerFrame);

      const computeFrameIndex = (timestamp: number) => {
        const epoch = Math.floor((timestamp - genesisTime) / secondsPerSlot / slotsPerEpoch);
        return Math.floor((epoch - initialEpoch) / epochsPerFrame);
      };

      const getFrame = (frameIndex: number) => {
        const frameStartEpoch = Math.floor(initialEpoch + frameIndex * epochsPerFrame);
        const frameStartSlot = frameStartEpoch * slotsPerEpoch;
        const nextFrameStartSlot = frameStartSlot + epochsPerFrame * slotsPerEpoch;

        return {
          index: frameIndex,
          refSlot: frameStartSlot - 1,
          reportProcessingDeadlineSlot: nextFrameStartSlot - 1,
        };
      };

      const formatOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        timeZoneName: 'short',
        hour12: false,
      };
      const intl = new Intl.DateTimeFormat('en-GB', formatOptions);

      const slotToTime = (slot: number) => {
        const time = (genesisTime + slot * secondsPerSlot) * 1000;
        return intl.format(time);
      };

      const nowUnix = Math.floor(Date.now() / 1000);
      const currentSlot = Math.floor((nowUnix - genesisTime) / secondsPerSlot);

      const currentFrame = getFrame(computeFrameIndex(nowUnix));
      const nextFrame = getFrame(currentFrame.index + 1);

      const getFrameSlots = (frame: { refSlot: number; reportProcessingDeadlineSlot: number }) => {
        const refSlot = frame.refSlot;
        const deadlineSlot = frame.reportProcessingDeadlineSlot;

        return [
          { value: 'ref slot', slot: refSlot, time: slotToTime(refSlot) },
          { value: 'deadline slot', slot: deadlineSlot, time: slotToTime(deadlineSlot) },
        ];
      };

      console.log('current slot');
      console.table([
        {
          value: 'current slot',
          slot: currentSlot,
          time: slotToTime(currentSlot),
        },
      ]);

      console.log();
      console.log('current report frame');
      console.table(getFrameSlots(currentFrame));

      console.log();
      console.log('next report frame');
      console.table(getFrameSlots(nextFrame));
    });
};
