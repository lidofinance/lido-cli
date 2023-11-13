import { program } from '@command';
import { simpleDVTContract } from '@contracts';
import { addAragonAppSubCommands, addCuratedModuleSubCommands, addLogsCommands, addParsingCommands } from './common';

const simpleDVT = program.command('simple-dvt').description('interact with simple dvt module contract');
addAragonAppSubCommands(simpleDVT, simpleDVTContract);
addParsingCommands(simpleDVT, simpleDVTContract);
addLogsCommands(simpleDVT, simpleDVTContract);
addCuratedModuleSubCommands(simpleDVT, simpleDVTContract);
