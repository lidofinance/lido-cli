import { program } from '@command';
import { withdrawalRequestContract } from '@contracts';

import { addLogsCommands, addOssifiableProxyCommands, addParsingCommands } from './common';
import { addVersionedSubCommands } from './common/versioned';

const withdrawalVault = program
  .command('withdrawal-vault')
  .aliases(['wv'])
  .description('interact with withdrawal vault contract');
addOssifiableProxyCommands(withdrawalVault, withdrawalRequestContract);
addParsingCommands(withdrawalVault, withdrawalRequestContract);
addLogsCommands(withdrawalVault, withdrawalRequestContract);
addVersionedSubCommands(withdrawalVault, withdrawalRequestContract);
