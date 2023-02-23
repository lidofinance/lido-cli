import { program } from '@command';
import { consensusForAccountingContract } from '@contracts';
import { addAccessControlSubCommands, addConsensusCommands, addParsingCommands } from './common';

const oracle = program
  .command('accounting-consensus')
  .description('interact with hash consensus contract for accounting oracle');
addAccessControlSubCommands(oracle, consensusForAccountingContract);
addParsingCommands(oracle, consensusForAccountingContract);
addConsensusCommands(oracle, consensusForAccountingContract);
