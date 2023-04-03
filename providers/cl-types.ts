export type ValidatorContainer = {
  index: string;
  balance: string;
  status: string;
  validator: Validator;
};

export type Validator = {
  pubkey: string;
  withdrawal_credentials: string;
  effective_balance: string;
  slashed: boolean;
  activation_eligibility_epoch: string;
  activation_epoch: string;
  exit_epoch: string;
  withdrawable_epoch: string;
};

export type SignedVoluntaryExit = {
  message: VoluntaryExit;
  signature: string;
};

export type VoluntaryExit = {
  epoch: string;
  validator_index: string;
};

export type Attestation = {
  aggregation_bits: string;
  data: AttestationData;
  signature: string;
};

export type AttestationData = {
  slot: string;
  index: string;
  beacon_block_root: string;
  source: Checkpoint;
  target: Checkpoint;
};

export type Deposit = {
  proof: string[];
  data: DepositData;
};

export type DepositData = {
  pubkey: string;
  withdrawal_credentials: string;
  amount: string;
  signature: string;
};

export type ProposerSlashing = {
  signed_header_1: SignedBeaconBlockHeader;
  signed_header_2: SignedBeaconBlockHeader;
};

export type SignedBeaconBlockHeaderContainer = {
  root: string;
  canonical: boolean;
  header: SignedBeaconBlockHeader;
};

export type SignedBeaconBlockHeader = {
  message: BeaconBlockHeader;
  signature: string;
};

export type BeaconBlockHeader = {
  slot: string;
  proposer_index: string;
  parent_root: string;
  state_root: string;
  body_root: string;
};

export type AttesterSlashing = {
  attestation_1: IndexedAttestation;
  attestation_2: IndexedAttestation;
};

export type IndexedAttestation = {
  attesting_indices: string[];
  data: AttestationData;
  signature: string;
};

export type Checkpoint = {
  epoch: string;
  root: string;
};

export type SignedBeaconBlock = {
  message: BeaconBlock;
  signature: string;
};

export type BeaconBlock = {
  slot: string;
  proposer_index: string;
  parent_root: string;
  state_root: string;
  body: BeaconBlockBody;
};

export type BeaconBlockBody = {
  randao_reveal: string;
  eth1_data: {
    deposit_root: string;
    deposit_count: string;
    block_hash: string;
  };
  graffiti: string;
  proposer_slashings: ProposerSlashing[];
  attester_slashings: AttesterSlashing[];
  attestations: Attestation[];
  deposits: Deposit[];
  voluntary_exits: SignedVoluntaryExit[];
  execution_payload: ExecutionPayload;
};

export type ExecutionPayload = {
  parent_hash: string;
  fee_recipient: string;
  state_root: string;
  receipts_root: string;
  logs_bloom: string;
  random: string;
  block_number: string;
  gas_limit: string;
  gas_used: string;
  timestamp: string;
  extra_data: string;
  base_fee_per_gas: string;
  block_hash: string;
  transactions: string[];
};

export type Genesis = {
  genesis_time: string;
  genesis_validators_root: string;
  genesis_fork_version: string;
};

export type Fork = {
  previous_version: string;
  current_version: string;
  epoch: string;
};
