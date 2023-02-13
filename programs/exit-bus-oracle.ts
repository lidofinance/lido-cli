import { program } from '../command';
import { exitBusOracleContract } from '../contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const oracle = program.command('exit-bus-oracle');
addAccessControlSubCommands(oracle, exitBusOracleContract);
addParsingCommands(oracle, exitBusOracleContract);
