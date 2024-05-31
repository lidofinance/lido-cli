import { program } from '@command';
import { consensusForExitBusContract } from '@contracts';
import { addAccessControlSubCommands, addConsensusCommands, addLogsCommands, addParsingCommands } from './common';

const oracle = program
  .command('exit-bus-consensus')
  .aliases(['vebo-consensus'])
  .description('interact with hash consensus contract for validator exit bus oracle');
addAccessControlSubCommands(oracle, consensusForExitBusContract);
addParsingCommands(oracle, consensusForExitBusContract);
addConsensusCommands(oracle, consensusForExitBusContract);
addLogsCommands(oracle, consensusForExitBusContract);
