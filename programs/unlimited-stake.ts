import { program } from '@command';
import { lidoContract, unlimitedStakeContract } from '@contracts';
import { contractCallTxWithConfirm, isTrue } from '@utils';
import { addLogsCommands, addParsingCommands } from './common';
import { parseEther, ZeroAddress } from 'ethers';

const lido = program.command('unlimited-stake').description('interact with unlimited stake contract');
addParsingCommands(lido, lidoContract);
addLogsCommands(lido, lidoContract);

lido
  .command('set-allowed')
  .description('set allowed account for unlimited stake contract')
  .argument('<account>', 'account')
  .option('-a, --allowed <bool>', 'allowed', true)
  .action(async (account, options) => {
    const { allowed } = options;
    await contractCallTxWithConfirm(unlimitedStakeContract, 'setAllowed', [account, isTrue(allowed)]);
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
