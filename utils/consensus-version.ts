export const detectConsensusVersionByEpoch = (spec: Record<string, string>, epoch: number | bigint) => {
  const forkVersions: Record<string, bigint> = {};
  const forkEpochs: Record<string, bigint> = {};

  for (const [key, value] of Object.entries(spec)) {
    if (key.endsWith('_FORK_VERSION')) {
      const forkName = key.replace('_FORK_VERSION', '');
      forkVersions[forkName] = BigInt(value);
    }
    if (key.endsWith('_FORK_EPOCH')) {
      const forkName = key.replace('_FORK_EPOCH', '');
      forkEpochs[forkName] = BigInt(value);
    }
  }

  let detectedFork = 'PHASE0';
  let detectedForkVerion = BigInt(0);

  for (const [forkName, forkEpoch] of Object.entries(forkEpochs)) {
    if (BigInt(epoch) >= forkEpoch && forkVersions[forkName] > detectedForkVerion) {
      detectedFork = forkName;
      detectedForkVerion = forkVersions[forkName];
    }
  }

  return detectedFork.toLocaleLowerCase();
};
