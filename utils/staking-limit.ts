export function calcStakeLimitIncreasePerBlock(dailyLimit: bigint) {
  const secondsPerBlock = 12n;
  const secondsPerDay = 24n * 60n * 60n;
  const blocksPerDay = secondsPerDay / secondsPerBlock;

  return dailyLimit / blocksPerDay;
}
