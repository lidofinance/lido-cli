import { encodeFromAgent } from '@scripts';
import { logger } from '@utils';
import { Contract } from 'ethers';
import { encodeFromAgentGrantRole } from './access-control';
import { aragonAgentAddress } from '@contracts';

export const encodeUnpauseIfPaused = async (contractName: string, contract: Contract) => {
  console.log('>>>>>> pu1');
  const isPaused = await contract.isPaused({gasLimit: 16_000_000});
  console.log('>>>>>>> pu2');
  if (isPaused) {
    logger.log('Contract is paused. Preparing scripts');
    return await encodeScriptsResume(contractName, contract);
  }

  logger.warn('Contract is already resumed. Skipping resume');
  return [];
};

export const encodeScriptsResume = async (contractName: string, contract: Contract) => {
  console.log('>>>>>> pu1');
  const [, grantResumeRoleCall] = await encodeFromAgentGrantRole(
    contractName,
    contract,
    'RESUME_ROLE',
    aragonAgentAddress,
  );
  console.log('>>>>>> pu2');
  const [, resumeWQCall] = await encodeFromAgentResume(contractName, contract);
  return [grantResumeRoleCall, resumeWQCall];
};

export const encodeFromAgentResume = async (contractName: string, contract: Contract) => {
  console.log('>>>>>>> 3');
  return encodeFromAgent({
    to: await contract.getAddress({gasLimit: 16_000_000}),
    data: contract.interface.encodeFunctionData('resume'),
    desc: `${contractName}: Resume contract`,
    gasLimit: 16_000_000,
  });
};
