import { Contract, Provider } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import moduleAbi from 'abi/csm/CSModule.json';
import accountingAbi from 'abi/csm/CSAccounting.json';
import feeDistributorAbi from 'abi/csm/CSFeeDistributor.json';
import feeOracleAbi from 'abi/csm/CSFeeOracle.json';
import permissionlessGateAbi from 'abi/csm/PermissionlessGate.json';
import { getVersion } from './initializable';

export const csModuleAddress = getOptionalDeployedAddress('csm.module.address');
export const csModuleContract = new Contract(csModuleAddress, moduleAbi, wallet);

export const csPermissionlessGateAddress = getOptionalDeployedAddress('csm.permissionlessGate.address');
export const csPermissionlessGateContract = new Contract(csPermissionlessGateAddress, permissionlessGateAbi, wallet);

export const csAccountingAddress = getOptionalDeployedAddress('csm.accounting.address');
export const csAccountingContract = new Contract(csAccountingAddress, accountingAbi, wallet);

export const csFeeDistributorAddress = getOptionalDeployedAddress('csm.feeDistributor.address');
export const csFeeDistributorContract = new Contract(csFeeDistributorAddress, feeDistributorAbi, wallet);

export const csFeeOracleAddress = getOptionalDeployedAddress('csm.feeOracle.address');
export const csFeeOracleContract = new Contract(csFeeOracleAddress, feeOracleAbi, wallet);

export const permissionlessGateAddress = getOptionalDeployedAddress('csm.permissionlessGate.address');
export const permissionlessGateContract = new Contract(permissionlessGateAddress, permissionlessGateAbi, wallet);

export async function getCSMVersion(provider: Provider | null): Promise<bigint> {
  if (!provider) throw new Error('No provider available for `getCSMVersion`');
  return getVersion(provider, csModuleAddress);
}
