import { program } from '@command';
import { csmOracleContract } from '@contracts';

import {
  addAccessControlSubCommands,
  addBaseOracleCommands,
  addLogsCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
} from './common';

const oracle = program.command('csm-oracle').description('interact with validator csm oracle contract');
addAccessControlSubCommands(oracle, csmOracleContract);
addBaseOracleCommands(oracle, csmOracleContract);
addOssifiableProxyCommands(oracle, csmOracleContract);
addParsingCommands(oracle, csmOracleContract);
addPauseUntilSubCommands(oracle, csmOracleContract);
addLogsCommands(oracle, csmOracleContract);
