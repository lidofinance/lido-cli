import { envs } from '@configs';
import fetch from 'node-fetch';
import { SignedBeaconBlock, SignedBeaconBlockHeaderContainer, ValidatorContainer } from './cl-types';

export const fetchAllValidators = async (slotId: string | number = 'head') => {
  if (!envs?.CL_API_PROVIDER) {
    throw new Error('CL_API_PROVIDER is not defined');
  }

  const response = await fetch(`${envs.CL_API_PROVIDER}/eth/v1/beacon/states/${slotId}/validators`);
  const result = await response.json();

  return result.data as ValidatorContainer[];
};

export const fetchCLBlockHeader = async (blockId: string | number = 'head') => {
  if (!envs?.CL_API_PROVIDER) {
    throw new Error('CL_API_PROVIDER is not defined');
  }

  const response = await fetch(`${envs.CL_API_PROVIDER}/eth/v1/beacon/headers/${blockId}`);
  const result = await response.json();

  return result.data as SignedBeaconBlockHeaderContainer;
};

export const fetchCLBlock = async (blockId: string | number = 'head') => {
  if (!envs?.CL_API_PROVIDER) {
    throw new Error('CL_API_PROVIDER is not defined');
  }

  const response = await fetch(`${envs.CL_API_PROVIDER}/eth/v2/beacon/blocks/${blockId}`);
  const result = await response.json();

  return result.data as SignedBeaconBlock;
};
