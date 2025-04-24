import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress } from '@configs';
import abi from 'abi/ValidatorExitVerifier.json';

export const validatorExitVerifierAddress = getDeployedAddress('validatorExitVerifier.address');
export const validatorExitVerifierContract = new Contract(validatorExitVerifierAddress, abi, wallet);
