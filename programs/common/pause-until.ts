import { Command } from 'commander';
import { Contract, MaxUint256, toBeHex } from 'ethers';

export const addPauseUntilSubCommands = (command: Command, contract: Contract) => {
  command.command('is-paused').action(async () => {
    const paused = await contract.isPaused();
    console.log('paused', paused);
  });

  command.command('resume').action(async () => {
    await contract.resume();
    console.log('resumed');
  });

  command
    .command('pause')
    .option('-d, --duration <string>', 'pause duration', toBeHex(MaxUint256))
    .action(async (options) => {
      const { duration } = options;
      await contract.pause(duration);
      console.log('paused');
    });
};
