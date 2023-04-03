import { Type, ValueOf } from '@chainsafe/ssz';
import { SigningData, Domain } from './ssz-types';

export const computeSigningRoot = <T>(type: Type<T>, sszObject: T, domain: ValueOf<typeof Domain>): Uint8Array => {
  return SigningData.hashTreeRoot({
    objectRoot: type.hashTreeRoot(sszObject),
    domain,
  });
};
