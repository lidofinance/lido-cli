import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import splitMainAbi from 'abi/SplitMain.json';
import splitWalletAbi from 'abi/SplitWallet.json';

export const splitMainAddress = getOptionalDeployedAddress('0xSplit.splitMain.address');
export const splitMainContract = new Contract(splitMainAddress, splitMainAbi, wallet);

export { splitWalletAbi };
