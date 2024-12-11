import { encodeFromAgent } from '@scripts';
import { logger } from '@utils';
import { Contract } from 'ethers';
import { encodeFromAgentGrantRole } from './access-control';
import { aragonAgentAddress } from '@contracts';

export const encodeUnpauseIfPaused = async (contractName: string, contract: Contract) => {
  const isPaused = await contract.isPaused();

  if (isPaused) {
    logger.log('Contract is paused. Preparing scripts');
    return await encodeScriptsResume(contractName, contract);
  }

  logger.warn('Contract is already resumed. Skipping resume');
  return [];
};

export const encodeScriptsResume = async (contractName: string, contract: Contract) => {
  const [, grantResumeRoleCall] = await encodeFromAgentGrantRole(
    contractName,
    contract,
    'RESUME_ROLE',
    aragonAgentAddress,
  );

  const [, resumeWQCall] = await encodeFromAgentResume(contractName, contract);
  return [grantResumeRoleCall, resumeWQCall];
};

export const encodeFromAgentResume = async (contractName: string, contract: Contract) => {
  return encodeFromAgent({
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData('resume'),
    desc: `${contractName}: Resume contract`,
  });
};
