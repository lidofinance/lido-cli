import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getOptionalDeployedAddress } from '@configs';
import factoryAbi from 'abi/ObolLidoSplitFactory.json';
import obolLidoSplitAbi from 'abi/ObolLidoSplit.json';

export const obolLidoSplitFactoryObolAddress = getOptionalDeployedAddress('obolLidoSplit.factory.obol.address');
export const obolLidoSplitFactoryObolContract = new Contract(obolLidoSplitFactoryObolAddress, factoryAbi, wallet);

export const obolLidoSplitFactorySSVAddress = getOptionalDeployedAddress('obolLidoSplit.factory.ssv.address');
export const obolLidoSplitFactorySSVContract = new Contract(obolLidoSplitFactorySSVAddress, factoryAbi, wallet);

export { obolLidoSplitAbi };
