import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/LazyOracle.json';

export const lazyOracleAddress = getDeployedAddress('lazyOracle');
export const lazyOracleContract = new Contract(lazyOracleAddress, abi, wallet);
