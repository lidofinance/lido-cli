import { program } from '@command';
import { envs } from '@configs';
import fetch from 'node-fetch';

const validators = program.command('validators').description('validators utils');

export type KAPIKey = {
  key: string;
  depositSignature: string;
  operatorIndex: number;
  used: boolean;
  moduleAddress: string;
};

export type CLValidator = {
  index: string;
  balance: string;
  status: string;
  validator: {
    pubkey: string;
    withdrawal_credentials: string;
    effective_balance: string;
    slashed: boolean;
    activation_eligibility_epoch: string;
    activation_epoch: string;
    exit_epoch: string;
    withdrawable_epoch: string;
  };
};

const fetchKeys = async () => {
  if (!envs?.KEYS_API_PROVIDER) {
    throw new Error('KEYS_API_PROVIDER is not defined');
  }

  console.log('fetching keys from KAPI, it may take a while...');
  const response = await fetch(`${envs.KEYS_API_PROVIDER}/v1/keys`);
  const result = await response.json();

  return result.data as KAPIKey[];
};

const fetchValidators = async () => {
  if (!envs?.CL_API_PROVIDER) {
    throw new Error('CL_API_PROVIDER is not defined');
  }

  console.log('fetching validators from CL, it may take a few minutes...');
  const response = await fetch(`${envs.CL_API_PROVIDER}/eth/v1/beacon/states/head/validators`);
  const result = await response.json();

  return result.data as CLValidator[];
};

validators
  .command('0x00')
  .description('fetches lido validators with 0x00 withdraw credentials')
  .action(async () => {
    if (!envs?.CL_API_PROVIDER) {
      throw new Error('CL_API_PROVIDER is not defined');
    }

    if (!envs?.KEYS_API_PROVIDER) {
      throw new Error('KEYS_API_PROVIDER is not defined');
    }

    const keys = await fetchKeys();
    const validators = await fetchValidators();

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
