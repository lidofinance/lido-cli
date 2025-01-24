import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/WithdrawalVault.json';
import proxyAbi from 'abi/WithdrawalManagerProxy.json';

export const withdrawalVaultAddress = getDeployedAddress('withdrawalVault.proxy');
export const withdrawalVaultContract = new Contract(withdrawalVaultAddress, abi, wallet);
export const withdrawalVaultProxyContract = new Contract(withdrawalVaultAddress, proxyAbi, wallet);
