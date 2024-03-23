import {
  BLSPubkey,
  Bytes32,
  DOMAIN_DEPOSIT,
  DepositMessage,
  UintNum64,
  ZERO_HASH,
  computeDomain,
  computeSigningRoot,
  fromHexString,
} from '@consensus';
import { fetchSpec } from '@providers';
import { stakingRouterContract } from '@contracts';
import { toHexString } from './to-hex-string';

export type DepositData = {
  pubkey: string;
  withdrawalCredentials: string;
  amount: bigint;
  signature: string;
  depositMessageRoot?: string;
  depositDataRoot?: string;
  forkVersion?: string;
  networkName?: string;
  depositCliVersion?: string;
};

export const supplementAndVerifyDepositDataArray = async (depositDataArray: DepositData[]): Promise<boolean> => {
  const suplplementedDepositDataArray = await supplementDepositDataArray(depositDataArray.map(normilizeDepositDta));
  return suplplementedDepositDataArray.every(verifyDepositData);
};

export const normilizeDepositDta = (depositData: DepositData & Record<string, unknown>): DepositData => {
  const {
    withdrawal_credentials,
    deposit_message_root,
    deposit_data_root,
    fork_version,
    network_name,
    deposit_cli_version,
  } = depositData;

  const {
    pubkey,
    withdrawalCredentials,
    amount,
    signature,
    depositMessageRoot,
    depositDataRoot,
    forkVersion,
    networkName,
    depositCliVersion,
  } = depositData;

  return {
    pubkey: toHexString(pubkey),
    withdrawalCredentials: toHexString(withdrawal_credentials || withdrawalCredentials),
    amount: BigInt(amount),
    signature: toHexString(signature),
    depositMessageRoot: toHexString(deposit_message_root || depositMessageRoot),
    depositDataRoot: toHexString(deposit_data_root || depositDataRoot),
    forkVersion: toHexString(fork_version || forkVersion),
    networkName: toHexString(network_name || networkName),
    depositCliVersion: toHexString(deposit_cli_version || depositCliVersion),
  };
};

export const supplementDepositDataArray = async (depositDataArray: DepositData[]): Promise<DepositData[]> => {
  const withdrawalCredentials = await stakingRouterContract.getWithdrawalCredentials();
  const spec = await fetchSpec();
  const forkVersion = spec.GENESIS_FORK_VERSION;

  return depositDataArray.map((depositData) => {
    if (depositData.withdrawalCredentials && depositData.withdrawalCredentials !== withdrawalCredentials) {
      throw new Error('Withdrawal credentials do not match the withdrawal credentials from the contract');
    }

    if (depositData.forkVersion && depositData.forkVersion !== forkVersion) {
      throw new Error('Fork version mismatch the CL one');
    }

    return { ...depositData, forkVersion, withdrawalCredentials };
  });
};

export const verifyDepositData = (depositData: DepositData): boolean => {
  if (!depositData.pubkey) throw new Error('Pubkey is not defined');
  if (!depositData.withdrawalCredentials) throw new Error('Withdrawal credentials is not defined');
  if (!depositData.amount) throw new Error('Amount is not defined');
  if (!depositData.signature) throw new Error('Signature is not defined');
  if (!depositData.forkVersion) throw new Error('Fork version is not defined');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const blst = require('@chainsafe/blst');

  const { pubkey, withdrawalCredentials, amount, signature, forkVersion } = depositData;

  const depositMessage = {
    pubkey: BLSPubkey.fromJson(toHexString(pubkey)),
    withdrawalCredentials: Bytes32.fromJson(toHexString(withdrawalCredentials)),
    amount: UintNum64.fromJson(toHexString(amount)),
  };

  const domain = computeDomain(DOMAIN_DEPOSIT, fromHexString(toHexString(forkVersion)), ZERO_HASH);
  const signingRoot = computeSigningRoot(DepositMessage, depositMessage, domain);

  const blsPublicKey = blst.PublicKey.fromBytes(depositMessage.pubkey);
  const blsSignature = blst.Signature.fromBytes(fromHexString(toHexString(signature)));

  return blst.verify(signingRoot, blsPublicKey, blsSignature);
};
