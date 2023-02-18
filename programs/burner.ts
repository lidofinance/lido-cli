import { program } from '../command';
import { burnerContract } from '../contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const burner = program.command('burner');
addAccessControlSubCommands(burner, burnerContract);
addParsingCommands(burner, burnerContract);
