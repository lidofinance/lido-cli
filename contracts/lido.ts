import { Contract } from 'ethers';
import { wallet } from '../wallet';
import deployed from '../deployed-zhejiang.json';
import abi from '../abi/Lido.json';

export const lidoAddress = deployed['app:lido'].proxyAddress;
export const lidoContract = new Contract(lidoAddress, abi, wallet);
