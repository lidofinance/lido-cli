import { envs } from '@configs';
import { JsonRpcProvider, Network } from 'ethers';

if (!envs?.EL_NETWORK_NAME) {
  throw new Error('EL_NETWORK_NAME is not defined');
}

if (!envs?.EL_CHAIN_ID) {
  throw new Error('EL_CHAIN_ID is not defined');
}

const network = new Network(envs.EL_NETWORK_NAME, envs.EL_CHAIN_ID);
const options = { staticNetwork: network, batchMaxCount: 1 };

export const provider = new JsonRpcProvider(envs?.EL_API_PROVIDER, network, options);
