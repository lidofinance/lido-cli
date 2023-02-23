import { Contract } from 'ethers';
import { wallet } from '@provider';
import deployed from 'deployed-zhejiang.json';
import consensusAbi from 'abi/HashConsensus.json';
import accountingAbi from 'abi/AccountingOracle.json';
import exitBusAbi from 'abi/ValidatorsExitBusOracle.json';
import configAbi from 'abi/OracleDaemonConfig.json';

export const accountingOracleAddress = deployed['accountingOracle'].address;
export const accountingOracleContract = new Contract(accountingOracleAddress, accountingAbi, wallet);

export const exitBusOracleAddress = deployed['validatorsExitBusOracle'].address;
export const exitBusOracleContract = new Contract(exitBusOracleAddress, exitBusAbi, wallet);

export const consensusForAccountingAddress = deployed['hashConsensusForAccounting'].address;
export const consensusForAccountingContract = new Contract(consensusForAccountingAddress, consensusAbi, wallet);

export const consensusForExitBusAddress = deployed['hashConsensusForValidatorsExitBus'].address;
export const consensusForExitBusContract = new Contract(consensusForExitBusAddress, consensusAbi, wallet);

export const oracleConfigAddress = deployed['oracleDaemonConfig'].address;
export const oracleConfigContract = new Contract(oracleConfigAddress, configAbi, wallet);
