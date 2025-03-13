import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/VaultHub.json';

export const vaultHubAddress = getDeployedAddress('vaultHub');
export const vaultHubContract = new Contract(vaultHubAddress, abi, wallet);
