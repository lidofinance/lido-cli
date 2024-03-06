import { ContainerType, ByteVectorType, UintBigintType, UintNumberType } from '@chainsafe/ssz';

export const Bytes4 = new ByteVectorType(4);
export const Bytes20 = new ByteVectorType(20);
export const Bytes32 = new ByteVectorType(32);
export const Bytes48 = new ByteVectorType(48);

export const UintNum64 = new UintNumberType(8);

export const UintBn64 = new UintBigintType(8);

export const ValidatorIndex = UintNum64;
export const WithdrawalIndex = UintNum64;
export const Root = new ByteVectorType(32);

export const Version = Bytes4;
export const DomainType = Bytes4;
export const BLSPubkey = Bytes48;
export const Domain = Bytes32;
export const ExecutionAddress = Bytes20;

export const ForkData = new ContainerType(
  {
    currentVersion: Version,
    genesisValidatorsRoot: Root,
  },
  { typeName: 'ForkData', jsonCase: 'eth2' },
);

export const SigningData = new ContainerType(
  {
    objectRoot: Root,
    domain: Domain,
  },
  { typeName: 'SigningData', jsonCase: 'eth2' },
);

export const CheckpointBigint = new ContainerType(
  {
    epoch: UintBn64,
    root: Root,
  },
  { typeName: 'Checkpoint', jsonCase: 'eth2' },
);

export const AttestationDataBigint = new ContainerType(
  {
    slot: UintBn64,
    index: UintBn64,
    beaconBlockRoot: Root,
    source: CheckpointBigint,
    target: CheckpointBigint,
  },
  { typeName: 'AttestationData', jsonCase: 'eth2', cachePermanentRootStruct: true },
);

export const DepositMessage = new ContainerType(
  { pubkey: BLSPubkey, withdrawalCredentials: Bytes32, amount: UintNum64 },
  { typeName: 'DepositMessage', jsonCase: 'eth2' },
);
