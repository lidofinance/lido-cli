import { Contract } from 'ethers';
import { wallet } from '@providers';
import abi from 'abi/ConsolidationGateway.json';
import { getDeployedAddress } from '@configs';

export const consolidationGatewayAddress = getDeployedAddress('consolidationGateway');
export const consolidationGatewayContract = new Contract(consolidationGatewayAddress, abi, wallet);
