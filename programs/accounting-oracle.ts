import { program } from '@command';
import { accountingOracleContract } from '@contracts';
import {
  addAccessControlSubCommands,
  addBaseOracleCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
} from './common';

const oracle = program.command('accounting-oracle').description('interact with accounting oracle contract');
addAccessControlSubCommands(oracle, accountingOracleContract);
addBaseOracleCommands(oracle, accountingOracleContract);
addOssifiableProxyCommands(oracle, accountingOracleContract);
addParsingCommands(oracle, accountingOracleContract);
