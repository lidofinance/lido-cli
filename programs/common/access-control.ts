import { Command } from 'commander';
import { Contract } from 'ethers';
import { wallet } from '../../wallet';

export const addAccessControlSubCommands = (command: Command, contract: Contract) => {
  command
    .command('get-role')
    .argument('<string>', 'role name')
    .action(async (method) => {
      const result = await contract[method]();
      console.log('role', result);
    });

  command
    .command('can-perform')
    .option('-r, --role <string>', 'role')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (options) => {
      const { address, role } = options;
      const result = await contract.canPerform(address, role, []);
      console.log('can perform', result);
    });

  command
    .command('grant-role')
    .option('-r, --role <string>', 'role')
    .option('-a, --address <string>', 'address')
    .action(async (options) => {
      const { role, address } = options;
      await contract.grantRole(role, address);
    });

  command
    .command('revoke-role')
    .option('-r, --role <string>', 'role')
    .option('-a, --address <string>', 'address')
    .action(async (options) => {
      const { role, address } = options;
      await contract.revokeRole(role, address);
    });
};
