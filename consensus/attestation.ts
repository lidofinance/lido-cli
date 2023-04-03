import { SecretKey } from '@chainsafe/blst';
import { ValueOf } from '@chainsafe/ssz';
import { computeSigningRoot } from './signing-root';
import { AttestationDataBigint } from './ssz-types';

export const signAttestationData = (
  domain: Uint8Array,
  sk: SecretKey,
  data: ValueOf<typeof AttestationDataBigint>,
): Uint8Array => {
  const signingRoot = computeSigningRoot(AttestationDataBigint, data, domain);
  return sk.sign(signingRoot).toBytes();
};
