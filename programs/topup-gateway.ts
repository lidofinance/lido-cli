import { program } from '@command';
import { topUpGatewayContract } from '@contracts';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands, addPauseUntilSubCommands } from './common';

const topUpGateway = program
  .command('topup-gateway')
  .aliases(['tug', 'topup'])
  .description('interact with top-up gateway contract');

// Add common sub-commands
addAccessControlSubCommands(topUpGateway, topUpGatewayContract);
addParsingCommands(topUpGateway, topUpGatewayContract);
addPauseUntilSubCommands(topUpGateway, topUpGatewayContract);
addLogsCommands(topUpGateway, topUpGatewayContract);
