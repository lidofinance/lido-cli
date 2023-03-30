import { program } from '@command';
import { fetchAllLidoKeys, fetchAllValidators, KAPIKey } from '@providers';

const validators = program.command('validators').description('validators utils');

validators
  .command('0x00')
  .description('fetches lido validators with 0x00 withdraw credentials')
  .action(async () => {
    console.log('fetching keys from KAPI, it may take a while...');
    const keys = await fetchAllLidoKeys();

    console.log('fetching validators from CL, it may take a few minutes...');
    const validators = await fetchAllValidators();

    const keysMap = keys.reduce((acc, signingKey) => {
      acc[signingKey.key] = signingKey;
      return acc;
    }, {} as Record<string, KAPIKey>);

    const lidoValidators = validators.filter(({ validator }) => {
      return keysMap[validator.pubkey];
    });

    console.log('validators on CL', lidoValidators.length);

    const validatorsWith0x00WC = lidoValidators.filter(({ validator }) => {
      return validator.withdrawal_credentials.startsWith('0x00');
    });

    console.log('validators with 0x00 wc', validatorsWith0x00WC.length);

    const nodeOperatorIds = validatorsWith0x00WC.reduce((acc, { validator }) => {
      const key = keysMap[validator.pubkey];
      if (!acc[key.operatorIndex]) {
        acc[key.operatorIndex] = 0;
      }

      acc[key.operatorIndex] += 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('operators with 0x00 wc', nodeOperatorIds);
  });
