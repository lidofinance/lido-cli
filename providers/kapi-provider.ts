import { envs } from '@configs';
import fetch, { RequestInit } from 'node-fetch';

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
  const url = 'v1/keys';
  const data = (await fetchKAPI(url)) as KAPIKey[];

  return data;
};

export const fetchLidoModuleKeys = async (keyOptions: KeysOptions) => {
  const queryParams = [];

  if (keyOptions.nodeOperatorId) {
    queryParams.push(`operatorIndex=${keyOptions.nodeOperatorId}`);
  }

  if (keyOptions.used) {
    queryParams.push(`used=${keyOptions.used}`);
  }

  const query = queryParams.join('&');
  const url = `v1/modules/${keyOptions.moduleId}/keys${query ? `?${query}` : ''}`;
  const data = (await fetchKAPI(url)) as { keys: KAPIKey[] };

  return data.keys;
};

export const fetchLidoModuleOperators = async (moduleId: number) => {
  const url = `v1/modules/${moduleId}/operators`;
  const data = (await fetchKAPI(url)) as { operators: KAPIOperator[] };

  return data.operators;
};

export const fetchLidoModuleOperator = async (moduleId: number, nodeOperatorId: number) => {
  const url = `v1/modules/${moduleId}/operators/${nodeOperatorId}`;
  const data = (await fetchKAPI(url)) as { operator: KAPIOperator };

  return data.operator;
};

export const fetchKAPI = async (endpoint: string, options: RequestInit = {}) => {
  if (!envs?.KEYS_API_PROVIDER) {
    throw new Error('KEYS_API_PROVIDER is not defined');
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(`${envs.KEYS_API_PROVIDER}/${endpoint}`, mergedOptions);
  const result = (await response.json()) as { data: unknown };

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${JSON.stringify(result)}`);
  }

  return result.data;
};
