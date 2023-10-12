import { program } from '@command';
import { ldoContract } from '@contracts';
import { addAragonAppSubCommands, addLogsCommands, addParsingCommands } from './common';
import { addERC20Commands } from './common/erc20';

const ldo = program.command('ldo').description('interact with LDO contract');
addAragonAppSubCommands(ldo, ldoContract);
addParsingCommands(ldo, ldoContract);
addLogsCommands(ldo, ldoContract);
addERC20Commands(ldo, ldoContract);
