import { program } from '@command';
import { norContract } from '@contracts';
import {
  addAragonAppSubCommands,
  addCuratedModuleSubCommands,
  addDeadlineCommands,
  addLogsCommands,
  addParsingCommands,
} from './common';

const nor = program
  .command('nor')
  .aliases(['curated', 'curated-module'])
  .description('interact with node operator registry contract');
addAragonAppSubCommands(nor, norContract);
addParsingCommands(nor, norContract);
addLogsCommands(nor, norContract);
addCuratedModuleSubCommands(nor, norContract);
addDeadlineCommands(nor, norContract, { moduleName: 'NOR', commandName: 'nor' });
