import { Contract } from 'ethers';
import { wallet } from '@providers';
import abi from 'abi/TopUpGateway.json';
import { getOptionalDeployedAddress } from '@configs';

export const topUpGatewayAddress = getOptionalDeployedAddress('topUpGateway.proxy', 'topUpGateway');
export const topUpGatewayContract = new Contract(topUpGatewayAddress, abi, wallet);
