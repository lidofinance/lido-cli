import { provider } from '@providers';

export const getChainId = async (): Promise<number> => {
  const network = await provider.getNetwork();
  return Number(network.chainId);
};
