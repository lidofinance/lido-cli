import { formatEther, parseEther } from 'ethers';
import { program } from '@command';
import { lidoContract } from '@contracts';
import { forwardVoteFromTm } from '@utils';
import { resumeLidoAndSetStakingLimit, votingForward } from '@scripts';
import { addAragonAppSubCommands, addParsingCommands } from './common';

const lido = program.command('lido').description('interact with lido contract');
addAragonAppSubCommands(lido, lidoContract);
addParsingCommands(lido, lidoContract);

lido
  .command('start-protocol')
  .description('resumes protocol and staking, sets staking limit')
  .option('-l, --staking-limit <number>', 'daily staking limit', '150000')
  .action(async (options) => {
    const { stakingLimit } = options;
    const limit = parseEther(stakingLimit);
    console.log('staking limit', limit);

    const [lidoCalldata] = resumeLidoAndSetStakingLimit(limit);
    const [votingCalldata] = votingForward(lidoCalldata);

    await forwardVoteFromTm(votingCalldata);
  });

lido
  .command('total-supply')
  .description('returns total stETH supply')
  .action(async () => {
    const totalSupply = await lidoContract.totalSupply();
    console.log('total supply', formatEther(totalSupply));
  });

lido
  .command('is-stopped')
  .description('returns is protocol stopped')
  .action(async () => {
    const isStopped = await lidoContract.isStopped();
    console.log('is stopped', isStopped);
  });

lido
  .command('is-staking-paused')
  .description('returns is staking paused')
  .action(async () => {
    const isStakingPaused = await lidoContract.isStakingPaused();
    console.log('is staking paused', isStakingPaused);
  });

lido
  .command('buffered-ether')
  .description('returns buffered ethers')
  .action(async () => {
    const bufferedEther = await lidoContract.getBufferedEther();
    console.log('buffered ether', formatEther(bufferedEther));
  });

lido
  .command('deposit')
  .description('deposit buffered ether')
  .argument('<deposits>', 'max deposits count')
  .argument('<module-id>', 'staking module id')
  .action(async (maxDepositCount, moduleId) => {
    await lidoContract.deposit(maxDepositCount, moduleId, '0x');
    console.log('deposited');
  });

lido
  .command('depositable-ether')
  .description('returns depositable ether amount')
  .action(async () => {
    const amount = await lidoContract.getDepositableEther();
    console.log('depositable ether', formatEther(amount));
  });
