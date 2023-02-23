import { BaseContract, Contract } from 'ethers';
import { wallet } from '@provider';
import { lidoContract } from './lido';
import kernelAbi from 'abi/aragon/Kernel.json';
import aclAbi from 'abi/aragon/ACL.json';

export const getKernelAddress = (): Promise<string> => lidoContract.kernel();
export const kernelContract = new BaseContract({ getAddress: getKernelAddress }, kernelAbi, wallet) as Contract;

export const getAclAddress = (): Promise<string> => kernelContract.acl();
export const aclContract = new BaseContract({ getAddress: getAclAddress }, aclAbi, wallet) as Contract;
