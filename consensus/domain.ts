import { ForkData, Version, DomainType, Root } from './ssz-types';
import { ValueOf } from '@chainsafe/ssz';

export const computeDomain = (
  domainType: ValueOf<typeof DomainType>,
  forkVersion: ValueOf<typeof Version>,
  genesisValidatorRoot: ValueOf<typeof Root>,
): Uint8Array => {
  const forkDataRoot = computeForkDataRoot(forkVersion, genesisValidatorRoot);
  const domain = new Uint8Array(32);
  domain.set(domainType, 0);
  domain.set(forkDataRoot.slice(0, 28), 4);
  return domain;
};

export const computeForkDataRoot = (
  currentVersion: ValueOf<typeof Version>,
  genesisValidatorsRoot: ValueOf<typeof Root>,
): Uint8Array => {
  return ForkData.hashTreeRoot({ currentVersion, genesisValidatorsRoot });
};
