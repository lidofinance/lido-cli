import { Command } from 'commander';
import { Contract } from 'ethers';

import {
  aclContract,
  kernelContract,
  getAppProxyContract,
  ensContract,
  getPublicResolverContract,
  getRepoContract,
} from '@contracts';
import { authorizedCall, forwardVoteFromTm, getRoleHash, logger } from '@utils';
import { wallet } from '@providers';
import { updateAragonApp, votingForward } from '@scripts';

export const addAragonAppSubCommands = (command: Command, contract: Contract) => {
  const getProxyAddress = async () => await contract.getAddress();
  const proxyContract = getAppProxyContract(getProxyAddress);

  command
    .command('get-role')
    .description('returns a hash of the role')
    .argument('<role>', 'role name')
    .action(async (role) => {
      const roleHash = await getRoleHash(contract, role);
      logger.log('Role hash', roleHash);
    });

  command
    .command('can-perform')
    .description('checks if the address can perform the role')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const roleHash = await getRoleHash(contract, role);
      const result = await contract.canPerform(address, roleHash, []);
      logger.log('Can perform', result);
    });

  command
    .command('has-permission')
    .description('checks if the address has the permission')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const roleHash = await getRoleHash(contract, role);
      const appAddress = await contract.getAddress();

      const result = await kernelContract.hasPermission(address, appAddress, roleHash, '0x');
      logger.log('Has permission', result);
    });

  command
    .command('acl-has-permission')
    .description('checks if the address has the permission')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const roleHash = await getRoleHash(contract, role);
      const appAddress = await contract.getAddress();

      const result = await aclContract.hasPermission(address, appAddress, roleHash);
      logger.log('Has permission', result);
    });

  command
    .command('get-permission-manager')
    .description('returns the permission manager address')
    .argument('<role>', 'role name or role hash')
    .action(async (role) => {
      const roleHash = await getRoleHash(contract, role);
      const appAddress = await contract.getAddress();

      const manager = await aclContract.getPermissionManager(appAddress, roleHash);
      logger.log('Manager', manager);
    });

  command
    .command('create-permission')
    .description('creates the permission')
    .argument('<role>', 'role name or role hash')
    .option('-m, --manager <string>', 'role manager address', wallet.address)
    .option('-a, --address <string>', 'address that will be able to perform the role', wallet.address)
    .action(async (role, options) => {
      const { manager, address } = options;
      const roleHash = await getRoleHash(contract, role);
      const appAddress = await contract.getAddress();

      await authorizedCall(aclContract, 'createPermission', [address, appAddress, roleHash, manager]);
    });

  command
    .command('grant-permission')
    .description('grants the permission to the address')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const appAddress = await contract.getAddress();
      const roleHash = await getRoleHash(contract, role);

      await authorizedCall(aclContract, 'grantPermission', [address, appAddress, roleHash]);
    });

  command
    .command('revoke-permission')
    .description('revokes the permission from the address')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const appAddress = await contract.getAddress();
      const roleHash = await getRoleHash(contract, role);

      await authorizedCall(aclContract, 'revokePermission', [address, appAddress, roleHash]);
    });

  command
    .command('implementation')
    .description('returns proxy implementation address')
    .action(async () => {
      const implementation = await proxyContract.implementation();
      logger.log('Implementation', implementation);
    });

  command
    .command('latest-version')
    .description('returns latest version of the app')
    .action(async () => {
      const appId = await proxyContract.appId();

      const getResolverAddress = () => ensContract.resolver(appId);
      const resolverContract = getPublicResolverContract(getResolverAddress);

      const getRepoAddress = () => resolverContract.addr(appId);
      const repoContract = getRepoContract(getRepoAddress);

      const version = await repoContract.getLatest();
      logger.log('Version', version.toObject());
    });

  command
    .command('implementation-upgrade-to')
    .description('replace app')
    .argument('<new-version>', 'new version')
    .argument('<new-implementation>', 'new implementation')
    .argument('<new-content-uri>', 'new content URI')
    .action(async (newVersion, newImplementation, newContentURI) => {
      const appId = await proxyContract.appId();

      const [calldata] = await updateAragonApp(newVersion.split(','), newImplementation, newContentURI, appId);
      const [votingCalldata] = votingForward(calldata);

      await forwardVoteFromTm(votingCalldata);
    });
};
