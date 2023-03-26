import { AbstractSigner, Contract } from 'ethers';
import { votingForward } from '@scripts';
import { aragonAgentAddress, votingAddress } from '@contracts';
import { encodeCallScript } from './scripts';
import { forwardVoteFromTm } from './voting';
import { contractCallTxWithConfirm } from './call-tx';
import { agentForward } from 'scripts/agent';

export const authorizedCall = async (contract: Contract, method: string, args: unknown[] = []) => {
  try {
    const passed = await authorizedCallEOA(contract, method, args);
    if (passed) return;
  } catch (error) {
    console.warn('direct call failed, trying to forward to the voting');
  }

  try {
    const passed = await authorizedCallVoting(contract, method, args);
    if (passed) return;
  } catch (error) {
    console.warn('call from voting failed');
  }

  try {
    const passed = await authorizedCallAgent(contract, method, args);
    if (passed) return;
  } catch (error) {
    console.warn('call from agent failed');
  }
};

export const authorizedCallEOA = async (contract: Contract, method: string, args: unknown[] = []) => {
  if (!(contract.runner instanceof AbstractSigner)) {
    throw new Error('Runner is not a signer');
  }

  const signer = contract.runner;
  const signerAddress = await signer.getAddress();

  await contract[method].staticCall(...args, { from: signerAddress });
  console.log('direct call passed successfully');

  await contractCallTxWithConfirm(contract, method, args);
  return true;
};

export const authorizedCallVoting = async (contract: Contract, method: string, args: unknown[] = []) => {
  const provider = contract.runner?.provider;

  if (!provider) {
    throw new Error('Provider is not set');
  }

  const contractWithoutSigner = contract.connect(provider);
  await contractWithoutSigner[method].staticCall(...args, { from: votingAddress });
  console.log('call from voting passed successfully');

  const call = {
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData(method, args),
  };

  const encoded = encodeCallScript([call]);

  const [votingCalldata] = votingForward(encoded);
  await forwardVoteFromTm(votingCalldata);
  return true;
};

export const authorizedCallAgent = async (contract: Contract, method: string, args: unknown[] = []) => {
  const provider = contract.runner?.provider;

  if (!provider) {
    throw new Error('Provider is not set');
  }

  const contractWithoutSigner = contract.connect(provider);
  await contractWithoutSigner[method].staticCall(...args, { from: aragonAgentAddress });
  console.log('call from agent voting passed successfully');

  const call = {
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData(method, args),
  };

  const encoded = encodeCallScript([call]);

  const [agentCalldata] = agentForward(encoded);
  const [votingCalldata] = votingForward(agentCalldata);
  await forwardVoteFromTm(votingCalldata);
  return true;
};
