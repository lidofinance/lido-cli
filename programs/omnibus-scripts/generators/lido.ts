import { lidoContract } from '@contracts';
import { resumeLidoAndSetStakingLimit } from '@scripts';
import { logger } from '@utils';
import { parseEther } from 'ethers';
import prompts from 'prompts';

export const promptScriptsLidoResumeIfStopped = async (initialStakingLimit: number) => {
  const isLidoStopped = await lidoContract.isStopped();

  if (isLidoStopped) {
    logger.log('Contract is stopped. Preparing scripts to resume and set staking limit');
    return await promptScriptsLidoResume(initialStakingLimit);
  }

  logger.warn('Contract is already running. Skipping resume and staking limit setting');
  return [];
};

export const promptScriptsLidoResume = async (initialStakingLimit: number) => {
  const { limit } = await prompts({
    type: 'number',
    name: 'limit',
    initial: initialStakingLimit,
    message: 'Enter daily Lido staking limit',
  });

  const parsedLimit = parseEther(String(limit));
  const [, resumeProtocolCall, resumeStakingCall, setStakingLimitCall] = resumeLidoAndSetStakingLimit(parsedLimit);
  return [resumeProtocolCall, resumeStakingCall, setStakingLimitCall];
};
