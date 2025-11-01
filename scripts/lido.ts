import { lidoAddress, lidoContract } from '@contracts';
import { calcStakeLimitIncreasePerBlock, encodeCallScript } from '@utils';
import { formatEther } from 'ethers';

export const resumeProtocol = () => {
  const call = {
    to: lidoAddress,
    data: lidoContract.interface.encodeFunctionData('resume'),
    desc: 'Lido: Resume protocol',
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};

export const resumeStaking = () => {
  const call = {
    to: lidoAddress,
    data: lidoContract.interface.encodeFunctionData('resumeStaking'),
    desc: 'Lido: Resume staking',
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};

export const setStakingLimit = (dailyStakingLimit: bigint) => {
  const stakeLimitIncreasePerBlock = calcStakeLimitIncreasePerBlock(dailyStakingLimit);

  const call = {
    to: lidoAddress,
    data: lidoContract.interface.encodeFunctionData('setStakingLimit', [dailyStakingLimit, stakeLimitIncreasePerBlock]),
    desc: `Lido: Set staking limit ${formatEther(dailyStakingLimit.toString())} ETH per day`,
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};

export const resumeLidoAndSetStakingLimit = (dailyStakingLimit: bigint) => {
  const [, resumeProtocolCall] = resumeProtocol();
  const [, setStakingLimitCall] = setStakingLimit(dailyStakingLimit);
  const calls = [resumeProtocolCall, setStakingLimitCall];

  const encoded = encodeCallScript(calls);
  return [encoded, ...calls] as const;
};
