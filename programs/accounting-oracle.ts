import { program } from '../command';
import { accountingOracleContract } from '../contracts';
import { addAccessControlSubCommands } from './common';

const oracle = program.command('accounting-oracle');
addAccessControlSubCommands(oracle, accountingOracleContract);

oracle
  .command('decode-calldata')
  .argument('<calldata>')
  .action(async (calldata) => {
    const result = accountingOracleContract.interface.decodeFunctionData(calldata.slice(0, 10), calldata);
    console.log(result);
  });

oracle
  .command('parse-error')
  .argument('<data>')
  .action(async (errorData) => {
    const result = accountingOracleContract.interface.parseError(errorData);
    console.log(result);
  });
