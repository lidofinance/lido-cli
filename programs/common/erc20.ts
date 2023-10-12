import { wallet } from '@providers';
import { contractCallTxWithConfirm } from '@utils';
import { Command } from 'commander';
import { Contract, MaxUint256, formatEther, parseEther } from 'ethers';

export const addERC20Commands = (command: Command, contract: Contract) => {
  command
    .command('name')
    .description('returns token name')
    .action(async () => {
      const name = await contract.name();
      console.log('token name', name);
    });

  command
    .command('symbol')
    .description('returns token symbol')
    .action(async () => {
      const symbol = await contract.symbol();
      console.log('token symbol', symbol);
    });

  command
    .command('decimals')
    .description('returns token decimals')
    .action(async () => {
      const decimals = await contract.decimals();
      console.log('token decimals', decimals);
    });

  command
    .command('total-supply')
    .description('returns total supply')
    .action(async () => {
      const totalSupply = await contract.totalSupply();
      console.log('total supply', formatEther(totalSupply));
    });

  command
    .command('balance-of')
    .argument('[address]', 'user address', wallet.address)
    .action(async (address) => {
      const balance = await contract.balanceOf(address);
      console.log('balance', formatEther(balance));
    });

  command
    .command('transfer')
    .argument('<to>', 'to address')
    .argument('<amount>', 'amount of tokens')
    .action(async (to, amount) => {
      await contractCallTxWithConfirm(contract, 'transfer', [to, parseEther(amount)]);
    });

  command
    .command('transfer-from')
    .argument('<from>', 'from address')
    .argument('<to>', 'to address')
    .argument('<amount>', 'amount of tokens')
    .action(async (from, to, amount) => {
      await contractCallTxWithConfirm(contract, 'transferFrom', [from, to, parseEther(amount)]);
    });

  command
    .command('approve')
    .argument('<spender>', 'spender address')
    .argument('[amount]', 'amount of tokens')
    .action(async (spender, amount) => {
      const parsedAmount = amount ? parseEther(amount) : MaxUint256;
      await contractCallTxWithConfirm(contract, 'approve', [spender, parsedAmount]);
    });

  command
    .command('allowance')
    .argument('<owner>', 'owner address')
    .argument('<spender>', 'spender address')
    .action(async (owner, spender) => {
      const allowance = await contract.allowance(owner, spender);
      console.log('allowance', formatEther(allowance));
    });
};
