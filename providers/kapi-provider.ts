import { envs } from '@configs';
import fetch from 'node-fetch';

export type KAPIKey = {
  key: string;
  depositSignature: string;
  operatorIndex: number;
  used: boolean;
  moduleAddress: string;
};

export const fetchAllLidoKeys = async () => {
  if (!envs?.KEYS_API_PROVIDER) {
    throw new Error('KEYS_API_PROVIDER is not defined');
  }

  const response = await fetch(`${envs.KEYS_API_PROVIDER}/v1/keys`, {
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await response.json();

  return result.data as KAPIKey[];
};
