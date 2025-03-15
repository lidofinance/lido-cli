import { ValueOf } from '@chainsafe/ssz';
import { computeSigningRoot } from './signing-root';
import { VoluntaryExit } from './ssz-types';

export const signVoluntaryExit = (
  domain: Uint8Array,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sk: any,
  data: ValueOf<typeof VoluntaryExit>,
): Uint8Array => {
  const signingRoot = computeSigningRoot(VoluntaryExit, data, domain);
  return sk.sign(signingRoot).toBytes();
};
