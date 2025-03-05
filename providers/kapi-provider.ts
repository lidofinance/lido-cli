import { envs } from '@configs';
import fetch from 'node-fetch';

export type KAPIKey = {
  key: string;
  index: number;
  depositSignature: string;
  operatorIndex: number;
  used: boolean;
  moduleAddress: string;
  vetted: boolean;
};

export type KAPIOperator = {
  index: number;
  active: boolean;
  name: string;
  rewardAddress: string;
  stakingLimit: number;
  stoppedValidators: number;
  totalSigningKeys: number;
  usedSigningKeys: number;
  moduleAddress: string;
};

type KeysOptions = {
  moduleId: number;
  used?: boolean;
  nodeOperatorId?: number;
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

export const fetchLidoModuleKeys = async (keyOptions: KeysOptions) => {
  if (!envs?.KEYS_API_PROVIDER) {
    throw new Error('KEYS_API_PROVIDER is not defined');
  }

  const options = {
    headers: { 'Content-Type': 'application/json' },
  };

  const queryParams = [];

  if (keyOptions.nodeOperatorId) {
    queryParams.push(`operatorIndex=${keyOptions.nodeOperatorId}`);
  }

  if (keyOptions.used) {
    queryParams.push(`used=${keyOptions.used}`);
  }

  const query = queryParams.join('&');

  const response = await fetch(
    `${envs.KEYS_API_PROVIDER}/v1/modules/${keyOptions.moduleId}/keys${query ? `?${query}` : ''}`,
    options,
  );
  const result = await response.json();

  return result.data.keys as KAPIKey[];
};

export const fetchLidoModuleOperators = async (moduleId: number) => {
  if (!envs?.KEYS_API_PROVIDER) {
    throw new Error('KEYS_API_PROVIDER is not defined');
  }

  const options = {
    headers: { 'Content-Type': 'application/json' },
  };

  const url = `${envs.KEYS_API_PROVIDER}/v1/modules/${moduleId}/operators`;

  const response = await fetch(url, options);
  const result = await response.json();

  return result.data.operators as KAPIOperator[];
};

export const fetchLidoModuleOperator = async (moduleId: number, nodeOperatorId: number) => {
  if (!envs?.KEYS_API_PROVIDER) {
    throw new Error('KEYS_API_PROVIDER is not defined');
  }

  const options = {
    headers: { 'Content-Type': 'application/json' },
  };

  const url = `${envs.KEYS_API_PROVIDER}/v1/modules/${moduleId}/operators/${nodeOperatorId}`;

  const response = await fetch(url, options);
  const result = await response.json();

  return result.data.operator as KAPIOperator;
};
