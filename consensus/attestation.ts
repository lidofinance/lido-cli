import { ValueOf } from '@chainsafe/ssz';
import { computeSigningRoot } from './signing-root';
import { AttestationDataBigint } from './ssz-types';

export const signAttestationData = (
  domain: Uint8Array,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sk: any,
  data: ValueOf<typeof AttestationDataBigint>,
): Uint8Array => {
  const signingRoot = computeSigningRoot(AttestationDataBigint, data, domain);
  return sk.sign(signingRoot).toBytes();
};
