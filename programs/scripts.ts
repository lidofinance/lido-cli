import { parseEther } from 'ethers';
import { program } from '@command';
import { resumeLidoAndSetStakingLimit, resumeProtocol, resumeStaking, setStakingLimit } from '@scripts';
import { logger } from '@utils';

const scripts = program.command('scripts').description('aragon scripts builder');

scripts
  .command('resume-protocol')
  .description('returns encoded resume protocol script')
  .action(async () => {
    const [encoded] = resumeProtocol();
    logger.log('Encoded', encoded);
  });

scripts
  .command('resume-staking')
  .description('returns encoded resume staking script')
  .action(async () => {
    const [encoded] = resumeStaking();
    logger.log('Encoded', encoded);
  });

scripts
  .command('set-staking-limit')
  .description('returns encoded set staking limit script')
  .option('-l, --staking-limit <number>', 'daily staking limit', '150000')
  .action(async (options) => {
    const { stakingLimit } = options;
    const limit = parseEther(stakingLimit);

    const [encoded] = setStakingLimit(limit);
    logger.log('Encoded', encoded);
  });

scripts
  .command('start-protocol')
  .description('returns encoded start protocol script')
  .option('-l, --staking-limit <number>', 'daily staking limit', '150000')
  .action(async (options) => {
    const { stakingLimit } = options;
    const limit = parseEther(stakingLimit);

    const [encoded] = resumeLidoAndSetStakingLimit(limit);
    logger.log('Encoded', encoded);
  });
