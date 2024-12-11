import { lstatSync } from 'fs';
import { resolve } from 'path';
import { envs } from './envs';
import { getValueByPath } from '@utils';
import { ZeroAddress } from 'ethers';

export const importConfigFile = (path?: string) => {
  const fullPath = resolve('configs', path ?? '');
  const json: Record<string, Record<string, string>> = {};

  if (lstatSync(fullPath).isFile()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Object.assign(json, require(fullPath));
  }

  return json;
};

export const getConfig = () => {
  const deployedFile = envs?.DEPLOYED;

  if (!deployedFile) {
    throw new Error('Deployed contracts file is not set, check .env file');
  }

  const mainDeployedJSON = importConfigFile(envs?.DEPLOYED);
  const extraDeployedJSON = importConfigFile(`extra-${envs?.DEPLOYED}`);

  return { ...mainDeployedJSON, ...extraDeployedJSON };
};

export const getContractDeploy = (path: string) => {
  return getValueByPath(getConfig(), path);
};

export const getConfigValue = (path: string) => {
  return getValueByPath(getConfig(), path);
};

export const getDeployedAddress = (...contractKeys: string[]) => {
  const contracts = contractKeys.map((contractKey) => getContractDeploy(contractKey));
  const contract = contracts.find((contract) => contract);

  if (typeof contract === 'string') {
    return contract;
  }

  if (!contract || typeof contract !== 'object') {
    throw new Error(`Contracts by ${contractKeys} not found`);
  }

  if ('proxyAddress' in contract) {
    return contract.proxyAddress as string;
  }

  if ('address' in contract) {
    return contract.address as string;
  }

  throw new Error(`Contracts by ${contractKeys} not found`);
};

export const getOptionalDeployedAddress = (...contractKeys: string[]) => {
  try {
    return getDeployedAddress(...contractKeys);
  } catch {
    return ZeroAddress;
  }
};

export const getAddressMap = () => {
  const contracts = getConfig();

  return Object.entries(contracts).reduce(
    (acc, [key, value]) => {
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
    },
    {} as Record<string, string>,
  );
};

let addressMapCache: Record<string, string> | undefined;

export const getCachedAddressMap = () => {
  if (!addressMapCache) {
    addressMapCache = getAddressMap();
  }

  return addressMapCache;
};
