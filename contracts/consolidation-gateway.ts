import { Contract } from 'ethers';
import { wallet } from '@providers';
import abi from 'abi/ConsolidationGateway.json';
import { getOptionalDeployedAddress } from '@configs';

export const consolidationGatewayAddress = getOptionalDeployedAddress('consolidationGateway');
export const consolidationGatewayContract = new Contract(consolidationGatewayAddress, abi, wallet);
