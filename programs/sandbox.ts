import { program } from '@command';
import { sandboxContract } from '@contracts';
import { addAragonAppSubCommands, addCuratedModuleSubCommands, addLogsCommands, addParsingCommands } from './common';

const sandbox = program
  .command('sandbox')
  .aliases(['sandbox-module'])
  .description('interact with simple dvt module contract');
addAragonAppSubCommands(sandbox, sandboxContract);
addParsingCommands(sandbox, sandboxContract);
addLogsCommands(sandbox, sandboxContract);
addCuratedModuleSubCommands(sandbox, sandboxContract);
