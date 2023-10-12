import { Contract } from 'ethers';
import { votingForward } from '@scripts';
import { aragonAgentAddress, votingAddress } from '@contracts';
import { encodeCallScript } from './scripts';
import { forwardVoteFromTm } from './voting';
import { contractCallTxWithConfirm } from './call-tx';
import { agentForward } from 'scripts/agent';
import { getProvider, getSignerAddress } from './contract';
import { logger } from './logger';

export const authorizedCall = async (contract: Contract, method: string, args: unknown[] = []) => {
  const errors = [];

  try {
    const passed = await authorizedCallEOA(contract, method, args);
    if (passed) return;
  } catch (error) {
    logger.warn('Direct call failed, trying to forward to the voting');
    errors.push(error);
  }

  try {
    const passed = await authorizedCallVoting(contract, method, args);
    if (passed) return;
  } catch (error) {
    logger.warn('Call from voting failed');
    errors.push(error);
  }

  try {
    const passed = await authorizedCallAgent(contract, method, args);
    if (passed) return;
  } catch (error) {
    logger.warn('Call from agent failed');
    errors.push(error);
  }

  logger.error(errors);
};

export const authorizedCallEOA = async (contract: Contract, method: string, args: unknown[] = []) => {
  const signerAddress = await getSignerAddress(contract);

  await contract[method].staticCall(...args, { from: signerAddress });
  printSuccess('EOA');

  await contractCallTxWithConfirm(contract, method, args);
  return true;
};

export const authorizedCallVoting = async (contract: Contract, method: string, args: unknown[] = []) => {
  authorizedCallTest(contract, method, args, votingAddress);
  printSuccess('voting');

  const encoded = await encode(contract, method, args);
  const [votingCalldata] = votingForward(encoded);
  await forwardVoteFromTm(votingCalldata);

  return true;
};

export const authorizedCallAgent = async (contract: Contract, method: string, args: unknown[] = []) => {
  authorizedCallTest(contract, method, args, aragonAgentAddress);
  printSuccess('agent');

  const encoded = await encode(contract, method, args);
  const [agentCalldata] = agentForward(encoded);
  const [votingCalldata] = votingForward(agentCalldata);
  await forwardVoteFromTm(votingCalldata);

  return true;
};

export const authorizedCallTest = async (contract: Contract, method: string, args: unknown[] = [], from: string) => {
  const provider = getProvider(contract);
  const contractWithoutSigner = contract.connect(provider) as Contract;
  await contractWithoutSigner[method].staticCall(...args, { from });
  return true;
};

const printSuccess = (from: string) => {
  logger.success(`\nCall from ${from} passed successfully`);
};

const encode = async (contract: Contract, method: string, args: unknown[] = []) => {
  const call = {
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData(method, args),
  };

  return encodeCallScript([call]);
};
