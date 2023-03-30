import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/OracleReportSanityChecker.json';

export const sanityCheckerAddress = getDeployedAddress('oracleReportSanityChecker');
export const sanityCheckerContract = new Contract(sanityCheckerAddress, abi, wallet);
