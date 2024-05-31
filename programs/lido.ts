import { formatEther, parseEther, ZeroAddress } from 'ethers';
import { program } from '@command';
import { lidoContract, unlimitedStakeContract } from '@contracts';
import { authorizedCall, contractCallTxWithConfirm, forwardVoteFromTm, logger } from '@utils';
import { resumeLidoAndSetStakingLimit, votingForward } from '@scripts';
import { addAragonAppSubCommands, addLogsCommands, addParsingCommands } from './common';
import { addERC20Commands } from './common/erc20';

const lido = program.command('lido').aliases(['steth']).description('interact with lido contract');
addAragonAppSubCommands(lido, lidoContract);
addParsingCommands(lido, lidoContract);
addLogsCommands(lido, lidoContract);
addERC20Commands(lido, lidoContract);

lido
  .command('start-protocol')
  .description('resumes protocol and staking, sets staking limit')
  .option('-l, --staking-limit <number>', 'daily staking limit', '150000')
  .action(async (options) => {
    const { stakingLimit } = options;
    const limit = parseEther(stakingLimit);
    logger.log('Staking limit', limit);

    const [lidoCalldata] = resumeLidoAndSetStakingLimit(limit);
    const [votingCalldata] = votingForward(lidoCalldata);

    await forwardVoteFromTm(votingCalldata);
  });

lido
  .command('total-shares')
  .description('returns total shares')
  .action(async () => {
    const totalShares = await lidoContract.getTotalShares();
    logger.log('Total shares', formatEther(totalShares));
  });

lido
  .command('is-stopped')
  .description('returns is protocol stopped')
  .action(async () => {
    const isStopped = await lidoContract.isStopped();
    logger.log('Is stopped', isStopped);
  });

lido
  .command('is-staking-paused')
  .description('returns is staking paused')
  .action(async () => {
    const isStakingPaused = await lidoContract.isStakingPaused();
    logger.log('Is staking paused', isStakingPaused);
  });

lido
  .command('buffered-ether')
  .description('returns buffered ethers')
  .action(async () => {
    const bufferedEther = await lidoContract.getBufferedEther();
    logger.log('Buffered ether', formatEther(bufferedEther));
  });

lido
  .command('deposit')
  .description('deposit buffered ether (works only if DSM is set to EOA)')
  .argument('<deposits>', 'max deposits count')
  .argument('<module-id>', 'staking module id')
  .action(async (maxDepositCount, moduleId) => {
    await contractCallTxWithConfirm(lidoContract, 'deposit', [maxDepositCount, moduleId, '0x']);
  });

lido
  .command('depositable-ether')
  .description('returns depositable ether amount')
  .action(async () => {
    const amount = await lidoContract.getDepositableEther();
    logger.log('Depositable ether', formatEther(amount));
  });

lido
  .command('submit')
  .description('submits ether amount')
  .argument('<amount>', 'ether amount')
  .option('-r, --referral <string>', 'referral address', ZeroAddress)
  .action(async (amount, options) => {
    const { referral } = options;
    await contractCallTxWithConfirm(lidoContract, 'submit', [referral, { value: parseEther(amount) }]);
  });

lido
  .command('staking-limit')
  .description('returns staking limit')
  .action(async () => {
    const limit = await lidoContract.getStakeLimitFullInfo();
    logger.log('Staking limit', limit.toObject());
  });

lido
  .command('set-staking-limit')
  .description('sets staking limit')
  .argument('<max-staking-limit>', 'max staking limit')
  .argument('<stake-limit-increase-per-block>', 'stake limit increase per block')
  .action(async (maxStakeLimit, stakeLimitIncreasePerBlock) => {
    await authorizedCall(lidoContract, 'setStakingLimit', [
      parseEther(maxStakeLimit),
      parseEther(stakeLimitIncreasePerBlock),
    ]);
  });

lido
  .command('unlimited-submit')
  .description('submits unlimited ether amount')
  .argument('<amount>', 'ether amount')
  .option('-r, --referral <string>', 'referral address', ZeroAddress)
  .action(async (amount, options) => {
    const { referral } = options;
    await contractCallTxWithConfirm(unlimitedStakeContract, 'unlimitedSubmit', [
      referral,
      { value: parseEther(amount) },
    ]);
  });
