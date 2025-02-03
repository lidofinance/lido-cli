import { program } from '@command';
import { withdrawalVaultContract, withdrawalVaultProxyContract } from '@contracts';
import { parseEther } from 'ethers';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands } from './common';
import { authorizedCall, logger } from '@utils';

const withdrawalVault = program
  .command('withdrawal-vault')
  .aliases(['wv'])
  .description('interact with withdrawal vault contract');
addAccessControlSubCommands(withdrawalVault, withdrawalVaultContract);
addParsingCommands(withdrawalVault, withdrawalVaultContract);
addLogsCommands(withdrawalVault, withdrawalVaultContract);

withdrawalVault
  .command('implementation')
  .description('returns proxy implementation address')
  .action(async () => {
    const implementation = await withdrawalVaultProxyContract.implementation();
    logger.log('Implementation', implementation);
  });

withdrawalVault
  .command('proxy-admin')
  .description('returns proxy admin address')
  .action(async () => {
    const admin = await withdrawalVaultProxyContract.proxy_getAdmin();
    logger.log('Admin', admin);
  });

withdrawalVault
  .command('proxy-upgrade-to')
  .description('replace proxy implementation address')
  .argument('<implementation>', 'new implementation')
  .action(async (implementation) => {
    await authorizedCall(withdrawalVaultProxyContract, 'proxy_upgradeTo', [implementation, '0x']);
  });

withdrawalVault
  .command('add-full-withdrawal-requests')
  .description('EIP-7002 add full withdrawal requests')
  .argument('<pubkeys>', 'validators public keys')
  .action(async (pubkeys) => {
    await authorizedCall(withdrawalVaultContract, 'addFullWithdrawalRequests', [
      pubkeys,
      {
        value: parseEther('0.1'),
      },
    ]);
  });

withdrawalVault
  .command('get-withdrawal-request-fee')
  .description('EIP-7002 current withdrawal fee')
  .action(async () => {
    const withdrawalFee = await withdrawalVaultContract.getWithdrawalRequestFee();
    logger.log('Withdrawal fee', withdrawalFee);
  });
