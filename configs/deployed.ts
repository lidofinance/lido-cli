import { lstatSync } from 'fs';
import { resolve } from 'path';
import { envs } from './envs';

export const getContracts = () => {
  const fullPath = resolve('configs', envs?.DEPLOYED ?? '');

  if (!lstatSync(fullPath).isFile()) {
    throw new Error('Deployed contracts file not found, check .env file');
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(fullPath) as Record<string, Record<string, string>>;
};

export const getContractDeploy = (contractKey: string) => {
  return getContracts()[contractKey];
};

export const getDeployedAddress = (contractKey: string) => {
  const contract = getContractDeploy(contractKey);

  if (!contract) {
    throw new Error(`Contract ${contractKey} not found`);
  }

  if (typeof contract === 'string') {
    return contract;
  }

  return contract.proxyAddress || contract.address;
};

export const getAddressMap = () => {
  const contracts = getContracts();

  return Object.entries(contracts).reduce((acc, [key, value]) => {
    const name = value.contract || key;
    const proxyAddress = value.proxyAddress || (value.implementation && value.address);
    const implementation = value.implementation;
    const isNotProxy = !implementation && !proxyAddress;

    if (proxyAddress) {
      acc[proxyAddress.toLowerCase()] = `Proxy (${name})`;
    }

    if (implementation) {
      acc[implementation.toLowerCase()] = `Implementation (${name})`;
    }

    if (isNotProxy && value.address) {
      acc[value.address.toLowerCase()] = name;
    }

    return acc;
  }, {} as Record<string, string>);
};

let addressMapCache: Record<string, string> | undefined;

export const getCachedAddressMap = () => {
  if (!addressMapCache) {
    addressMapCache = getAddressMap();
  }

  return addressMapCache;
};
