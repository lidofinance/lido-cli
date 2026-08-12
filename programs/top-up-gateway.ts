import { program } from '@command';
import { topUpGatewayContract } from '@contracts';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands, addPauseUntilSubCommands } from './common';

const topUpGateway = program
  .command('top-up-gateway')
  .aliases(['tug', 'topup-gateway'])
  .description('interact with top-up gateway contract');

// Add common sub-commands
addAccessControlSubCommands(topUpGateway, topUpGatewayContract);
addParsingCommands(topUpGateway, topUpGatewayContract);
addPauseUntilSubCommands(topUpGateway, topUpGatewayContract);
addLogsCommands(topUpGateway, topUpGatewayContract);
