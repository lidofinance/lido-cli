import { ensContract, getPublicResolverContract, getRepoContract, kernelContract } from '@contracts';
import { encodeCallScript } from '@utils';
import { Contract } from 'ethers';

export const newAragonVersion = async (
  repoContract: Contract,
  newVersion: string[],
  newImplementation: string,
  newContentURI: string,
) => {
  const repoAddress = await repoContract.getAddress();

  const call = {
    to: repoAddress,
    data: repoContract.interface.encodeFunctionData('newVersion', [newVersion, newImplementation, newContentURI]),
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};

export const setAragonApp = async (appId: string, newImplementation: string) => {
  const namespace = await kernelContract.APP_BASES_NAMESPACE();
  const kernelAddress = await kernelContract.getAddress();

  const call = {
    to: kernelAddress,
    data: kernelContract.interface.encodeFunctionData('setApp', [namespace, appId, newImplementation]),
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};

export const updateAragonApp = async (
  newVersion: string[],
  newImplementation: string,
  newContentURI: string,
  appId: string,
) => {
  const getResolverAddress = () => ensContract.resolver(appId);
  const resolverContract = getPublicResolverContract(getResolverAddress);

  const getRepoAddress = () => resolverContract.addr(appId);
  const repoContract = getRepoContract(getRepoAddress);

  const [, newVersionCall] = await newAragonVersion(repoContract, newVersion, newImplementation, newContentURI);
  const [, setAppCall] = await setAragonApp(appId, newImplementation);

  const encoded = encodeCallScript([newVersionCall, setAppCall]);
  return [encoded, newVersionCall, setAppCall] as const;
};
