import { program } from '@command';
import {consensusForExitBusContract, exitBusOracleContract} from '@contracts';
import { addAccessControlSubCommands, addConsensusCommands, addLogsCommands, addParsingCommands } from './common';
import {addVersionedSubCommands} from "./common/versioned";

const oracle = program
  .command('exit-bus-consensus')
  .aliases(['vebo-consensus'])
  .description('interact with hash consensus contract for validator exit bus oracle');
addAccessControlSubCommands(oracle, consensusForExitBusContract);
addParsingCommands(oracle, consensusForExitBusContract);
addConsensusCommands(oracle, consensusForExitBusContract);
addLogsCommands(oracle, consensusForExitBusContract);
addVersionedSubCommands(oracle, exitBusOracleContract);
