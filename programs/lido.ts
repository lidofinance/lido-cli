import { formatEther, parseEther } from 'ethers';
import { program } from '../command';
import { lidoContract } from '../contracts';
import { forwardVoteFromTm } from '../utils';
import { resumeLidoAndSetStakingLimit, votingForward } from '../scripts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const lido = program.command('lido');
addAccessControlSubCommands(lido, lidoContract);
addParsingCommands(lido, lidoContract);

lido
  .command('start-protocol')
  .option('-l, --staking-limit <number>', 'daily staking limit', '150000')
  .action(async (options) => {
    const { stakingLimit } = options;
    const limit = parseEther(stakingLimit);
    console.log('staking limit', limit);

    const [lidoCalldata] = resumeLidoAndSetStakingLimit(limit);
    const [votingCalldata] = votingForward(lidoCalldata);

    await forwardVoteFromTm(votingCalldata);
  });

lido.command('total-supply').action(async () => {
  const totalSupply = await lidoContract.totalSupply();
  console.log('total supply', formatEther(totalSupply));
});

lido.command('is-stopped').action(async () => {
  const isStopped = await lidoContract.isStopped();
  console.log('is stopped', isStopped);
});

lido.command('is-staking-paused').action(async () => {
  const isStakingPaused = await lidoContract.isStakingPaused();
  console.log('is staking paused', isStakingPaused);
});

lido.command('buffered-ether').action(async () => {
  const bufferedEther = await lidoContract.getBufferedEther();
  console.log('buffered ether', formatEther(bufferedEther));
});

lido
  .command('deposit')
  .argument('<number>', 'max deposits count')
  .argument('<number>', 'staking module id')
  .action(async (maxDepositCount, moduleId) => {
    await lidoContract.deposit(maxDepositCount, moduleId, '0x');
    console.log('deposited');
  });
