import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import moduleAbi from 'abi/csm/CSModule.json';
import accountingAbi from 'abi/csm/CSAccounting.json';

export const csModuleAddress = getOptionalDeployedAddress('csm.module.address');
export const csModuleContract = new Contract(csModuleAddress, moduleAbi, wallet);

export const csAccountingAddress = getOptionalDeployedAddress('csm.accounting.address');
export const csAccountingContract = new Contract(csAccountingAddress, accountingAbi, wallet);
