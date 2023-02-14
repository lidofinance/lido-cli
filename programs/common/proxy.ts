import { Command } from 'commander';
import { Contract } from 'ethers';
import { getProxyContract } from '../../contracts';

export const addOssifiableProxyCommands = (command: Command, contract: Contract) => {
  const getProxyAddress = async () => await contract.getAddress();
  const proxyContract = getProxyContract(getProxyAddress);

  command.command('proxy-get-implementation').action(async () => {
    const implementation = await proxyContract.proxy__getImplementation();
    console.log('implementation', implementation);
  });

  command.command('proxy-admin').action(async () => {
    const admin = await proxyContract.proxy__getAdmin();
    console.log('admin', admin);
  });

  command
    .command('proxy-upgrade-to')
    .argument('<string>', 'new implementation')
    .action(async (newImplementation) => {
      await proxyContract.proxy__upgradeTo(newImplementation);
      console.log('new implementation set');
    });
};
