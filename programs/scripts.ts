import { parseEther } from 'ethers';
import { program } from '../command';
import { resumeLidoAndSetStakingLimit, resumeProtocol, resumeStaking, setStakingLimit } from '../scripts';

const scripts = program.command('scripts');

scripts.command('resume-protocol').action(async () => {
  const [encoded] = resumeProtocol();
  console.log('encoded', encoded);
});

scripts.command('resume-staking').action(async () => {
  const [encoded] = resumeStaking();
  console.log('encoded', encoded);
});

scripts
  .command('set-staking-limit')
  .option('-l, --staking-limit <number>', 'daily staking limit', '150000')
  .action(async (options) => {
    const { stakingLimit } = options;
    const limit = parseEther(stakingLimit);

    const [encoded] = setStakingLimit(limit);
    console.log('encoded', encoded);
  });

scripts
  .command('start-protocol')
  .option('-l, --staking-limit <number>', 'daily staking limit', '150000')
  .action(async (options) => {
    const { stakingLimit } = options;
    const limit = parseEther(stakingLimit);

    const [encoded] = resumeLidoAndSetStakingLimit(limit);
    console.log('encoded', encoded);
  });
