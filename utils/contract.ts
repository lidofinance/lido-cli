import { AbstractSigner, Contract, Provider } from 'ethers';

export const getProvider = (contract: Contract): Provider => {
  const provider = contract.runner?.provider;

  if (!provider) {
    throw new Error('Provider is not set');
  }

  return provider;
};

export const getSigner = (contract: Contract): AbstractSigner => {
  if (!(contract.runner instanceof AbstractSigner)) {
    throw new Error('Runner is not a signer');
  }

  return contract.runner;
};

export const getSignerAddress = async (contract: Contract): Promise<string> => {
  const signer = getSigner(contract);

  return await signer.getAddress();
};
