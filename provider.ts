import { JsonRpcProvider, Network } from 'ethers';

const chainId = 1337803;
const url = 'http://35.228.211.212:8545';

const network = new Network('zhejiang', chainId);
const options = { staticNetwork: network };

export const provider = new JsonRpcProvider(url, network, options);
