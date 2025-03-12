import { Contract, Provider } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import moduleAbi from 'abi/csm/CSModule.json';
import accountingAbi from 'abi/csm/CSAccounting.json';
import feeDistributorAbi from 'abi/csm/CSFeeDistributor.json';
import feeOracleAbi from 'abi/csm/CSFeeOracle.json';
import permissionlessGateAbi from 'abi/csm/PermissionlessGate.json';

export const csModuleAddress = getOptionalDeployedAddress('csm.module.address');
export const csModuleContract = new Contract(csModuleAddress, moduleAbi, wallet);

export const csAccountingAddress = getOptionalDeployedAddress('csm.accounting.address');
export const csAccountingContract = new Contract(csAccountingAddress, accountingAbi, wallet);

export const csFeeDistributorAddress = getOptionalDeployedAddress('csm.feeDistributor.address');
export const csFeeDistributorContract = new Contract(csFeeDistributorAddress, feeDistributorAbi, wallet);

export const csFeeOracleAddress = getOptionalDeployedAddress('csm.feeOracle.address');
export const csFeeOracleContract = new Contract(csFeeOracleAddress, feeOracleAbi, wallet);

export const permissionslessGateAddress = getOptionalDeployedAddress('csm.permissionslessGate.address');
export const permissionslessGateContract = new Contract(permissionslessGateAddress, permissionlessGateAbi, wallet);

export async function getCSMVersion(provider: Provider | null): Promise<bigint> {
  if (!provider) throw new Error('No provider available for `getCSMVersion`');
  //  See Initializable.sol
  const INITIALIZABLE_STORAGE = BigInt('0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00');
  const slotValue = await provider.getStorage(csModuleAddress, INITIALIZABLE_STORAGE);
  return BigInt(slotValue) & (2n ** 64n - 1n);
}
