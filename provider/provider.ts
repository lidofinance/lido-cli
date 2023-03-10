import { envs } from '@configs';
import { JsonRpcProvider, Network } from 'ethers';

const chainId = 1337803;
const url = envs.EL_API_PROVIDER;

const network = new Network('zhejiang', chainId);
const options = { staticNetwork: network, batchMaxCount: 1 };

export const provider = new JsonRpcProvider(url, network, options);
