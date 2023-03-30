import { program } from '@command';
import { depositContract } from '@contracts';
import { contractCallTxWithConfirm } from '@utils';
import { parseEther } from 'ethers';
import { addLogsCommands, addParsingCommands } from './common';

const deposit = program.command('deposit-contract').description('interact with deposit contract');
addParsingCommands(deposit, depositContract);
addLogsCommands(deposit, depositContract);

deposit
  .command('deposit')
  .description('deposit ether to deposit contract')
  .argument('<amount>', 'deposit amount in ether')
  .argument('<pubkey>', 'validator pubkey')
  .argument('<withdrawal-credentials>', 'withdrawal credentials')
  .argument('<signature>', 'deposit signature')
  .argument('<deposit-data-root>', 'deposit data root')
  .action(async (amount, pubkey, withdrawalCredentials, signature, depositDataRoot) => {
    await contractCallTxWithConfirm(depositContract, 'deposit', [
      pubkey,
      withdrawalCredentials,
      signature,
      depositDataRoot,
      { value: parseEther(amount) },
    ]);
  });
