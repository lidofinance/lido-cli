import { program } from '@command';
import { consensusForCSMContract } from '@contracts';
import { addAccessControlSubCommands, addConsensusCommands, addLogsCommands, addParsingCommands } from './common';

const oracle = program.command('csm-consensus').description('interact with hash consensus contract for csm oracle');
addAccessControlSubCommands(oracle, consensusForCSMContract);
addParsingCommands(oracle, consensusForCSMContract);
addConsensusCommands(oracle, consensusForCSMContract);
addLogsCommands(oracle, consensusForCSMContract);
