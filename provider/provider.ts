import { envs } from '@configs';
import { JsonRpcProvider, Network } from 'ethers';

const network = new Network(envs.EL_NETWORK_NAME, envs.EL_CHAIN_ID);
const options = { staticNetwork: network, batchMaxCount: 1 };

export const provider = new JsonRpcProvider(envs.EL_API_PROVIDER, network, options);
