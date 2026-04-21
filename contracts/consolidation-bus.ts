import { Contract } from 'ethers';
import { wallet } from '@providers';
import abi from 'abi/ConsolidationBus.json';
import { getDeployedAddress } from '@configs';

export const consolidationBusAddress = getDeployedAddress('consolidationBus');
export const consolidationBusContract = new Contract(consolidationBusAddress, abi, wallet);
