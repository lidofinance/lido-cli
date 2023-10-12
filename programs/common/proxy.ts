import { Command } from 'commander';
import { Contract } from 'ethers';
import { getProxyContract } from '@contracts';
import { authorizedCall, logger } from '@utils';

export const addOssifiableProxyCommands = (command: Command, contract: Contract) => {
  const getProxyAddress = async () => await contract.getAddress();
  const proxyContract = getProxyContract(getProxyAddress);

  command
    .command('proxy-get-implementation')
    .description('returns proxy implementation address')
    .action(async () => {
      const implementation = await proxyContract.proxy__getImplementation();
      logger.log('Implementation', implementation);
    });

  command
    .command('proxy-admin')
    .description('returns proxy admin address')
    .action(async () => {
      const admin = await proxyContract.proxy__getAdmin();
      logger.log('Admin', admin);
    });

  command
    .command('proxy-upgrade-to')
    .description('replace proxy implementation address')
    .argument('<implementation>', 'new implementation')
    .action(async (implementation) => {
      await authorizedCall(proxyContract, 'proxy__upgradeTo', [implementation]);
    });
};
