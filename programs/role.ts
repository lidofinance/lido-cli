import { program } from '@command';
import {
  kernelContract,
  aclContract,
  accountingOracleContract,
  burnerContract,
  consensusForAccountingContract,
  consensusForExitBusContract,
  dsmContract,
  exitBusOracleContract,
  lidoContract,
  locatorContract,
  norContract,
  oracleConfigContract,
  sanityCheckerContract,
  stakingRouterContract,
  withdrawalRequestContract,
} from '@contracts';
import { FunctionFragment } from 'ethers';

const role = program.command('role').description('roles utils');

role
  .command('find')
  .argument('<hash>', 'role hash')
  .action(async (hash) => {
    const contracts = [
      kernelContract,
      aclContract,
      burnerContract,
      dsmContract,
      lidoContract,
      locatorContract,
      norContract,
      oracleConfigContract,
      accountingOracleContract,
      consensusForAccountingContract,
      consensusForExitBusContract,
      exitBusOracleContract,
      stakingRouterContract,
      sanityCheckerContract,
      lidoContract,
      withdrawalRequestContract,
    ];

    contracts.forEach((contract) => {
      contract.interface.fragments.forEach(async (fragment) => {
        try {
          const isRole = fragment instanceof FunctionFragment && fragment.name.endsWith('_ROLE');
          if (isRole) {
            const roleHash = await contract[fragment.name]();
            if (roleHash !== hash) return;

            console.log(fragment.name, roleHash);
          }
        } catch (error) {}
      });
    });
  });
