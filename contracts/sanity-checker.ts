import { Contract } from 'ethers';
import { wallet } from '@provider';
import deployed from 'deployed-zhejiang.json';
import abi from 'abi/OracleReportSanityChecker.json';

export const sanityCheckerAddress = deployed['oracleReportSanityChecker'].address;
export const sanityCheckerContract = new Contract(sanityCheckerAddress, abi, wallet);
