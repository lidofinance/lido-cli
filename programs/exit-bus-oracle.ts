import { program } from '../command';
import { exitBusOracleContract } from '../contracts';
import { addAccessControlSubCommands } from './common';

const oracle = program.command('exit-bus-oracle');
addAccessControlSubCommands(oracle, exitBusOracleContract);

oracle
  .command('decode-calldata')
  .argument('<calldata>')
  .action(async (calldata) => {
    const result = exitBusOracleContract.interface.decodeFunctionData(calldata.slice(0, 10), calldata);
    console.log(result);
  });

oracle
  .command('parse-error')
  .argument('<data>')
  .action(async (errorData) => {
    const result = exitBusOracleContract.interface.parseError(errorData);
    console.log(result);
  });
