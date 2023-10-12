import { wallet } from '@providers';
import { contractCallTxWithConfirm, logger } from '@utils';
import { Command } from 'commander';
import { Contract, MaxUint256, formatEther, parseEther } from 'ethers';

export const addERC20Commands = (command: Command, contract: Contract) => {
  command
    .command('name')
    .description('returns token name')
    .action(async () => {
      const name = await contract.name();
      logger.log('Token name', name);
    });

  command
    .command('symbol')
    .description('returns token symbol')
    .action(async () => {
      const symbol = await contract.symbol();
      logger.log('Token symbol', symbol);
    });

  command
    .command('decimals')
    .description('returns token decimals')
    .action(async () => {
      const decimals = await contract.decimals();
      logger.log('Token decimals', decimals);
    });

  command
    .command('total-supply')
    .description('returns total supply')
    .action(async () => {
      const totalSupply = await contract.totalSupply();
      logger.log('Total supply', formatEther(totalSupply));
    });

  command
    .command('balance-of')
    .argument('[address]', 'user address', wallet.address)
    .action(async (address) => {
      const balance = await contract.balanceOf(address);
      logger.log('Balance', formatEther(balance));
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
      logger.log('Allowance', formatEther(allowance));
    });
};
