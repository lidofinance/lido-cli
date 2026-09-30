import { BaseContract, Contract, Provider, ZeroAddress } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress, getOptionalMethodAddress } from '@configs';
import curatedModuleAbi from 'abi/csm/CuratedModule.json';
import accountingAbi from 'abi/csm/Accounting.json';
import feeDistributorAbi from 'abi/csm/FeeDistributor.json';
import feeOracleAbi from 'abi/csm/FeeOracle.json';
import curatedGateAbi from 'abi/csm/CuratedGate.json';
import metaRegistryAbi from 'abi/csm/MetaRegistry.json';
import ejectorAbi from 'abi/csm/Ejector.json';
import { getVersion } from './initializable';

export const cmv2ModuleAddress = getOptionalDeployedAddress('cmv2.module.address');
export const cmv2ModuleContract = new Contract(cmv2ModuleAddress, curatedModuleAbi, wallet);

export const cmv2CuratedGateAddress = getOptionalDeployedAddress('cmv2.curatedGate.address');
export const cmv2CuratedGateContract = new Contract(cmv2CuratedGateAddress, curatedGateAbi, wallet);

export const cmv2AccountingAddress = getOptionalDeployedAddress('cmv2.accounting.address');
export const cmv2AccountingContract = new Contract(cmv2AccountingAddress, accountingAbi, wallet);

export const cmv2FeeDistributorAddress = getOptionalDeployedAddress('cmv2.feeDistributor.address');
export const cmv2FeeDistributorContract = new Contract(cmv2FeeDistributorAddress, feeDistributorAbi, wallet);

export const cmv2FeeOracleAddress = getOptionalDeployedAddress('cmv2.feeOracle.address');
export const cmv2FeeOracleContract = new Contract(cmv2FeeOracleAddress, feeOracleAbi, wallet);

export const cmv2EjectorAddress = getOptionalDeployedAddress('cmv2.ejector.address');
export const cmv2EjectorContract = new Contract(cmv2EjectorAddress, ejectorAbi, wallet);

export const getCmv2MetaRegistryAddress = (): Promise<string> =>
  getOptionalMethodAddress(cmv2ModuleContract, 'META_REGISTRY');
export const cmv2MetaRegistryContract = new BaseContract(
  { getAddress: getCmv2MetaRegistryAddress },
  metaRegistryAbi,
  wallet,
) as Contract;

export const getModuleMetaRegistryAddress = async (
  moduleAddress: string,
  overrides: { blockTag?: number } = {},
): Promise<string> => {
  const moduleContract = cmv2ModuleContract.attach(moduleAddress) as Contract;

  try {
    const metaRegistryAddress: string = await moduleContract.META_REGISTRY(overrides);
    return metaRegistryAddress || ZeroAddress;
  } catch (error) {
    // a module without META_REGISTRY either reverts or returns empty data
    if (
      error != null &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'CALL_EXCEPTION' || error.code === 'BAD_DATA')
    ) {
      return ZeroAddress;
    }

    throw error;
  }
};

export const getCmv2MetaRegistryContract = (metaRegistryAddress: string): Contract =>
  new Contract(metaRegistryAddress, metaRegistryAbi, wallet);

export async function getCMv2Version(provider: Provider | null): Promise<bigint> {
  if (!provider) throw new Error('No provider available for `getCMv2Version`');
  return getVersion(provider, cmv2ModuleAddress);
}
