import { lstatSync } from 'fs';
import { resolve } from 'path';
import { envs } from './envs';

export const getContractDeploy = (contractKey: string) => {
  const fullPath = resolve('configs', envs.DEPLOYED);

  if (!lstatSync(fullPath).isFile()) {
    throw new Error('Deployed contracts file not found, check .env file');
  }

  const json = require(fullPath);
  return json[contractKey];
};

export const getDeployedAddress = (contractKey: string) => {
  const contract = getContractDeploy(contractKey);

  if (!contract) {
    throw new Error(`Contract ${contractKey} not found`);
  }

  return contract.proxyAddress || contract.address;
};
