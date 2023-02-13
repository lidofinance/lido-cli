import { Command } from 'commander';
import { Contract } from 'ethers';
import { aclContract } from '../../contracts';
import { wallet } from '../../wallet';

export const addAragonAppSubCommands = (command: Command, contract: Contract) => {
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
    .command('get-permission-manager')
    .option('-r, --role <string>', 'role')
    .action(async (options) => {
      const { role } = options;
      const manager = await aclContract.getPermissionManager(contract.getAddress(), role);
      console.log('manager', manager);
    });

  command
    .command('has-permission')
    .option('-a, --address <string>', 'address', wallet.address)
    .option('-r, --role <string>', 'role')
    .action(async (options) => {
      const { address, role } = options;
      const permission = await aclContract.hasPermission(address, contract.getAddress(), role);
      console.log('permission', permission);
    });
};
