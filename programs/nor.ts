import { program } from '@command';
import { norContract } from '@contracts';
import { addAragonAppSubCommands, addCuratedModuleSubCommands, addLogsCommands, addParsingCommands } from './common';

const nor = program.command('nor').description('interact with node operator registry contract');
addAragonAppSubCommands(nor, norContract);
addParsingCommands(nor, norContract);
addLogsCommands(nor, norContract);
addCuratedModuleSubCommands(nor, norContract);
