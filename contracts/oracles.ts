import { Contract } from 'ethers';
import { wallet } from '@provider';
import { getDeployedAddress } from '@configs';
import consensusAbi from 'abi/HashConsensus.json';
import accountingAbi from 'abi/AccountingOracle.json';
import exitBusAbi from 'abi/ValidatorsExitBusOracle.json';
import configAbi from 'abi/OracleDaemonConfig.json';

export const accountingOracleAddress = getDeployedAddress('accountingOracle');
export const accountingOracleContract = new Contract(accountingOracleAddress, accountingAbi, wallet);

export const exitBusOracleAddress = getDeployedAddress('validatorsExitBusOracle');
export const exitBusOracleContract = new Contract(exitBusOracleAddress, exitBusAbi, wallet);

export const consensusForAccountingAddress = getDeployedAddress('hashConsensusForAccounting');
export const consensusForAccountingContract = new Contract(consensusForAccountingAddress, consensusAbi, wallet);

export const consensusForExitBusAddress = getDeployedAddress('hashConsensusForValidatorsExitBus');
export const consensusForExitBusContract = new Contract(consensusForExitBusAddress, consensusAbi, wallet);

export const oracleConfigAddress = getDeployedAddress('oracleDaemonConfig');
export const oracleConfigContract = new Contract(oracleConfigAddress, configAbi, wallet);
