import { Contract } from 'ethers';
import { wallet } from '@providers';
import abi from 'abi/ConsolidationMigrator.json';
import { getDeployedAddress } from '@configs';

export const consolidationMigratorAddress = getDeployedAddress('consolidationMigrator');
export const consolidationMigratorContract = new Contract(consolidationMigratorAddress, abi, wallet);
