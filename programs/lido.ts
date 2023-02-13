import { formatEther } from 'ethers';
import { program } from '../command';
import { lidoContract } from '../contracts';
import { addAccessControlSubCommands } from './common';

const lido = program.command('lido');
addAccessControlSubCommands(lido, lidoContract);

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
