import { formatEther, MaxUint256, parseEther, ZeroAddress } from 'ethers';
import { program } from '@command';
import { wallet } from '@providers';
import { lidoContract } from '@contracts';
import { authorizedCall, contractCallTxWithConfirm, forwardVoteFromTm } from '@utils';
import { resumeLidoAndSetStakingLimit, votingForward } from '@scripts';
import { addAragonAppSubCommands, addLogsCommands, addParsingCommands } from './common';

const lido = program.command('lido').description('interact with lido contract');
addAragonAppSubCommands(lido, lidoContract);
addParsingCommands(lido, lidoContract);
addLogsCommands(lido, lidoContract);

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
  .command('total-shares')
  .description('returns total shares')
  .action(async () => {
    const totalShares = await lidoContract.getTotalShares();
    console.log('total shares', formatEther(totalShares));
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
    console.log('depositable ether', formatEther(amount));
  });

lido
  .command('approve')
  .argument('<spender>', 'spender address')
  .option('-a, --amount <number>', 'amount', '')
  .action(async (spender, options) => {
    const amount = options.amount ? parseEther(options.amount) : MaxUint256;
    await contractCallTxWithConfirm(lidoContract, 'approve', [spender, amount]);
  });

lido
  .command('allowance')
  .argument('<spender>', 'spender address')
  .option('-o, --owner <string>', 'owner address', wallet.address)
  .action(async (spender, options) => {
    const { owner } = options;
    const allowance = await lidoContract.allowance(owner, spender);
    console.log('allowance', allowance);
  });

lido
  .command('balance')
  .option('-a, --address <string>', 'user address', wallet.address)
  .action(async (options) => {
    const { address } = options;
    const balance = await lidoContract.balanceOf(address);
    console.log('balance', formatEther(balance));
  });

lido
  .command('transfer')
  .argument('<recipient>', 'recipient address')
  .argument('<amount>', 'amount of steth')
  .action(async (recipient, amount) => {
    await contractCallTxWithConfirm(lidoContract, 'transfer', [recipient, parseEther(amount)]);
  });

lido
  .command('submit')
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
    console.log('staking limit', limit.toObject());
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
