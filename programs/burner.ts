import { program } from '@command';
import { burnerContract } from '@contracts';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands } from './common';

const burner = program.command('burner').description('interact with burner contract');
addAccessControlSubCommands(burner, burnerContract);
addParsingCommands(burner, burnerContract);
addLogsCommands(burner, burnerContract);
