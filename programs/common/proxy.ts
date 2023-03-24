import { Command } from 'commander';
import { Contract } from 'ethers';
import { getProxyContract } from '@contracts';
import { authorizedCall } from '@utils';

export const addOssifiableProxyCommands = (command: Command, contract: Contract) => {
  const getProxyAddress = async () => await contract.getAddress();
  const proxyContract = getProxyContract(getProxyAddress);

  command
    .command('proxy-get-implementation')
    .description('returns proxy implementation address')
    .action(async () => {
      const implementation = await proxyContract.proxy__getImplementation();
      console.log('implementation', implementation);
    });

  command
    .command('proxy-admin')
    .description('returns proxy admin address')
    .action(async () => {
      const admin = await proxyContract.proxy__getAdmin();
      console.log('admin', admin);
    });

  command
    .command('proxy-upgrade-to')
    .description('replace proxy implementation address')
    .argument('<implementation>', 'new implementation')
    .action(async (implementation) => {
      await authorizedCall(proxyContract, 'proxy__upgradeTo', [implementation]);
    });
};
