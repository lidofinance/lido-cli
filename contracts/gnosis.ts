import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import gnosisSafeAbi from 'abi/GnosisSafe.json';
import gnosisSafeProxyFactoryAbi from 'abi/GnosisSafeProxyFactory.json';

export const gnosisSafeProxyFactoryAddress = getOptionalDeployedAddress('gnosis.factory.address');
export const gnosisSafeProxyFactoryContract = new Contract(
  gnosisSafeProxyFactoryAddress,
  gnosisSafeProxyFactoryAbi,
  wallet,
);

export const gnosisSafeSingletonAddress = getOptionalDeployedAddress('gnosis.singleton.address');
export const gnosisSafeSingletonContract = new Contract(gnosisSafeSingletonAddress, gnosisSafeAbi, wallet);

export { gnosisSafeAbi };
