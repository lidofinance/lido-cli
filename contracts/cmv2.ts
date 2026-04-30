import { BaseContract, Contract, Provider, ZeroAddress } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress, getOptionalMethodAddress } from '@configs';
import curatedModuleAbi from 'abi/csm/CuratedModule.json';
import accountingAbi from 'abi/csm/Accounting.json';
import feeDistributorAbi from 'abi/csm/FeeDistributor.json';
import feeOracleAbi from 'abi/csm/FeeOracle.json';
import permissionlessGateAbi from 'abi/csm/PermissionlessGate.json';
import curatedGateAbi from 'abi/csm/CuratedGate.json';
import vettedGateAbi from 'abi/csm/VettedGate.json';
import metaRegistryAbi from 'abi/csm/MetaRegistry.json';
import { getVersion } from './initializable';

export const cmv2ModuleAddress = getOptionalDeployedAddress('cmv2.module.address');
export const cmv2ModuleContract = new Contract(cmv2ModuleAddress, curatedModuleAbi, wallet);

export const cmv2VettedGateAddress = getOptionalDeployedAddress('cmv2.vettedGate.address');
export const cmv2VettedGateContract = new Contract(cmv2VettedGateAddress, vettedGateAbi, wallet);

export const cmv2PermissionlessGateAddress = getOptionalDeployedAddress('cmv2.permissionlessGate.address');
export const cmv2PermissionlessGateContract = new Contract(
  cmv2PermissionlessGateAddress,
  permissionlessGateAbi,
  wallet,
);

const curatedGateFromConfig = getOptionalDeployedAddress('cmv2.curatedGate.address');
export const cmv2CuratedGateAddress =
  curatedGateFromConfig !== ZeroAddress
    ? curatedGateFromConfig
    : cmv2VettedGateAddress !== ZeroAddress && cmv2PermissionlessGateAddress === ZeroAddress
      ? cmv2VettedGateAddress
      : ZeroAddress;
export const cmv2CuratedGateContract = new Contract(cmv2CuratedGateAddress, curatedGateAbi, wallet);

export const cmv2AccountingAddress = getOptionalDeployedAddress('cmv2.accounting.address');
export const cmv2AccountingContract = new Contract(cmv2AccountingAddress, accountingAbi, wallet);

export const cmv2FeeDistributorAddress = getOptionalDeployedAddress('cmv2.feeDistributor.address');
export const cmv2FeeDistributorContract = new Contract(cmv2FeeDistributorAddress, feeDistributorAbi, wallet);

export const cmv2FeeOracleAddress = getOptionalDeployedAddress('cmv2.feeOracle.address');
export const cmv2FeeOracleContract = new Contract(cmv2FeeOracleAddress, feeOracleAbi, wallet);

export const getCmv2MetaRegistryAddress = (): Promise<string> =>
  getOptionalMethodAddress(cmv2ModuleContract, 'META_REGISTRY');
export const cmv2MetaRegistryContract = new BaseContract(
  { getAddress: getCmv2MetaRegistryAddress },
  metaRegistryAbi,
  wallet,
) as Contract;

export async function getCMv2Version(provider: Provider | null): Promise<bigint> {
  if (!provider) throw new Error('No provider available for `getCMv2Version`');
  return getVersion(provider, cmv2ModuleAddress);
}
