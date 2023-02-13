import { program } from '../command';
import { accountingOracleContract } from '../contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const oracle = program.command('accounting-oracle');
addAccessControlSubCommands(oracle, accountingOracleContract);
addParsingCommands(oracle, accountingOracleContract);
