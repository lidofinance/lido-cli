import { program } from '@command';
import { allowedListContract } from '@contracts';
import { addLogsCommands, addParsingCommands } from './common';
import { authorizedCall, isTrue, logger } from '@utils';
import { Result } from 'ethers';

const allowedList = program
  .command('allowed-list')
  .aliases(['relay-list', 'allowed-relay-list'])
  .description('interact with MEV boost allowed relay list contract');
addParsingCommands(allowedList, allowedListContract);
addLogsCommands(allowedList, allowedListContract);

allowedList
  .command('get-relays')
  .aliases(['relays'])
  .description('returns the list of allowed relays')
  .action(async () => {
    const relays = await allowedListContract.get_relays();

    if (relays.length === 0) {
      logger.warn('No relays found');
      return;
    }

    relays.forEach((relay: Result) => {
      logger.log(relay.toObject());
    });
  });

allowedList
  .command('get-relay-by-uri')
  .aliases(['relay-by-uri', 'relay', 'get-relay'])
  .description('returns the relay by URI')
  .argument('<uri>', 'relay URI')
  .action(async (uri) => {
    const relay = await allowedListContract.get_relay_by_uri(uri);
    logger.log(relay.toObject());
  });

allowedList
  .command('get-relays-amount')
  .aliases(['relays-amount', 'amount'])
  .description('returns the amount of relays')
  .action(async () => {
    const amount = await allowedListContract.get_relays_amount();
    logger.log('Amount', Number(amount));
  });

allowedList
  .command('get-allowed-list-version')
  .aliases(['version', 'allowed-list-version', 'get-version', 'list-version'])
  .description('returns the version of the allowed list')
  .action(async () => {
    const version = await allowedListContract.get_allowed_list_version();
    logger.log('Version', Number(version));
  });

allowedList
  .command('add-relay')
  .aliases(['add'])
  .description('adds a relay to the allowed list')
  .argument('<uri>', 'relay URI')
  .argument('<operator>', 'relay operator name')
  .argument('<is-mandatory>', 'is relay mandatory (true or false)')
  .argument('<description>', 'relay description')
  .action(async (URI, operator, isMandatoryStr, description) => {
    const isMandatory = isTrue(isMandatoryStr);
    logger.table({ URI, operator, isMandatory, description });
    await authorizedCall(allowedListContract, 'add_relay', [URI, operator, isMandatory, description]);
  });

allowedList
  .command('remove-relay')
  .aliases(['remove'])
  .description('removes a relay from the allowed list')
  .argument('<uri>', 'relay URI')
  .action(async (URI) => {
    await authorizedCall(allowedListContract, 'remove_relay', [URI]);
  });

allowedList
  .command('get-manager')
  .aliases(['manager'])
  .description('returns the address of the relay list manager')
  .action(async () => {
    const manager = await allowedListContract.get_manager();
    logger.log('Manager', manager);
  });

allowedList
  .command('set-manager')
  .description('sets the address of the relay list manager')
  .argument('<manager>', 'new manager address')
  .action(async (manager) => {
    await authorizedCall(allowedListContract, 'set_manager', [manager]);
  });

allowedList
  .command('dissmiss-manager')
  .description('dismisses the relay list manager')
  .action(async () => {
    await authorizedCall(allowedListContract, 'dismiss_manager', []);
  });

allowedList
  .command('get-owner')
  .aliases(['owner'])
  .description('returns the address of the relay list owner')
  .action(async () => {
    const owner = await allowedListContract.get_owner();
    logger.log('Owner', owner);
  });

allowedList
  .command('change-owner')
  .description('change owner')
  .argument('<new-owner>', 'new owner')
  .action(async (newOwner) => {
    await authorizedCall(allowedListContract, 'change_owner', [newOwner]);
  });
