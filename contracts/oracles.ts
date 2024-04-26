import { Contract } from 'ethers';
import { wallet } from '@providers';
import { getDeployedAddress, getOptionalDeployedAddress } from '@configs';
import consensusAbi from 'abi/HashConsensus.json';
import accountingAbi from 'abi/AccountingOracle.json';
import csmOracleAbi from 'abi/csm/CSFeeOracle.json';
import exitBusAbi from 'abi/ValidatorsExitBusOracle.json';
import configAbi from 'abi/OracleDaemonConfig.json';

export const accountingOracleAddress = getDeployedAddress('accountingOracle.proxy', 'accountingOracle');
export const accountingOracleContract = new Contract(accountingOracleAddress, accountingAbi, wallet);

export const exitBusOracleAddress = getDeployedAddress('validatorsExitBusOracle.proxy', 'validatorsExitBusOracle');
export const exitBusOracleContract = new Contract(exitBusOracleAddress, exitBusAbi, wallet);

export const csmOracleAddress = getOptionalDeployedAddress('csm.feeOracle.address');
export const csmOracleContract = new Contract(csmOracleAddress, csmOracleAbi, wallet);

export const consensusForAccountingAddress = getDeployedAddress(
  'hashConsensusForAccountingOracle',
  'hashConsensusForAccounting',
);
export const consensusForAccountingContract = new Contract(consensusForAccountingAddress, consensusAbi, wallet);

export const consensusForExitBusAddress = getDeployedAddress(
  'hashConsensusForValidatorsExitBusOracle',
  'hashConsensusForValidatorsExitBus',
);
export const consensusForExitBusContract = new Contract(consensusForExitBusAddress, consensusAbi, wallet);

export const consensusForCSMAddress = getOptionalDeployedAddress('csm.hashConsensus.address');
export const consensusForCSMContract = new Contract(consensusForCSMAddress, consensusAbi, wallet);

export const oracleConfigAddress = getDeployedAddress('oracleDaemonConfig');
export const oracleConfigContract = new Contract(oracleConfigAddress, configAbi, wallet);
