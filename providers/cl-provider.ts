import { envs } from '@configs';
import { stringify } from '@utils';
import fetch, { RequestInit } from 'node-fetch';
import { Genesis, Fork, SignedBeaconBlock, SignedBeaconBlockHeaderContainer, ValidatorContainer } from './cl-types';

export const fetchCL = async (url: string, init?: RequestInit) => {
  if (!envs?.CL_API_PROVIDER) {
    throw new Error('CL_API_PROVIDER is not defined');
  }

  const response = await fetch(`${envs.CL_API_PROVIDER}/${url}`, init);
  return await response.json();
};

export const fetchAllValidators = async (stateId: string | number = 'head') => {
  const result = await fetchCL(`eth/v1/beacon/states/${stateId}/validators`);
  return result.data as ValidatorContainer[];
};

export const fetchValidator = async (validatorId: string, stateId: string | number = 'head') => {
  const result = await fetchCL(`eth/v1/beacon/states/${stateId}/validators/${validatorId}`);
  return result.data as ValidatorContainer;
};

export const fetchBlockHeader = async (blockId: string | number = 'head') => {
  const result = await fetchCL(`eth/v1/beacon/headers/${blockId}`);
  return result.data as SignedBeaconBlockHeaderContainer;
};

export const fetchBlock = async (blockId: string | number = 'head') => {
  const result = await fetchCL(`eth/v2/beacon/blocks/${blockId}`);
  return result.data as SignedBeaconBlock;
};

export const fetchGenesis = async () => {
  const result = await fetchCL(`eth/v1/beacon/genesis`);
  return result.data as Genesis;
};

export const fetchFork = async (stateId: string | number = 'head') => {
  const result = await fetchCL(`eth/v1/beacon/states/${stateId}/fork`);
  return result.data as Fork;
};

export const fetchSpec = async () => {
  const result = await fetchCL(`eth/v1/config/spec`);
  return result.data as Record<string, string>;
};

export const postToAttestationPool = async (body: unknown) => {
  return await fetchCL(`eth/v1/beacon/pool/attester_slashings`, {
    body: stringify(body),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
};
