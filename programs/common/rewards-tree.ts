import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { Contract } from 'ethers';
import { wallet } from '@providers';
import { logger } from '@utils';
import feeDistributorAbi from 'abi/csm/FeeDistributor.json';

export const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

const buildIpfsUrl = (gateway: string, cid: string) => {
  const trimmed = gateway.replace(/\/+$/, '');
  return `${trimmed}/${cid}`;
};

type RewardsTreeValue = [bigint | number, bigint | number];
type RewardsTreeDump = Parameters<typeof StandardMerkleTree.load<RewardsTreeValue>>[0];

// Node 21+ passes the original source text to JSON.parse revivers via the
// third argument so we can upgrade integer literals that exceed
// Number.MAX_SAFE_INTEGER (2^53 - 1) to bigints without losing precision.
type JSONReviverContext = { source?: string };
type JSONReviverWithContext = (key: string, value: unknown, context: JSONReviverContext) => unknown;

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

const reviveLargeInts: JSONReviverWithContext = (_key, value, context) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || !context.source) return value;
  if (!/^-?\d+$/.test(context.source)) return value;
  const big = BigInt(context.source);
  return big > MAX_SAFE_BIGINT || big < -MAX_SAFE_BIGINT ? big : value;
};

const parseTreeDump = (text: string): RewardsTreeDump =>
  JSON.parse(text, reviveLargeInts as Parameters<typeof JSON.parse>[1]);

const fetchRewardsTreeDump = async (gateway: string, cid: string): Promise<RewardsTreeDump> => {
  const url = buildIpfsUrl(gateway, cid);
  logger.log('Fetching rewards tree from', url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch rewards tree from ${url}: ${response.status} ${response.statusText}`);
  }
  return parseTreeDump(await response.text());
};

const findOperatorLeaf = (tree: StandardMerkleTree<RewardsTreeValue>, nodeOperatorId: bigint) => {
  for (const [index, value] of tree.entries()) {
    if (BigInt(value[0]) === nodeOperatorId) {
      return { index, cumulativeFeeShares: BigInt(value[1]) };
    }
  }
  return null;
};

export type RewardsLookup = { cumulativeFeeShares: bigint; proof: string[]; found: boolean };

export const fetchRewardsLookup = async (
  accountingContract: Contract,
  nodeOperatorId: string | number | bigint,
  gateway: string,
): Promise<RewardsLookup> => {
  const feeDistributorAddress = await accountingContract.FEE_DISTRIBUTOR();
  const feeDistributor = new Contract(feeDistributorAddress, feeDistributorAbi, wallet);
  const cid: string = await feeDistributor.treeCid();
  if (!cid) {
    logger.warn('Rewards tree CID is empty; falling back to empty proof');
    return { cumulativeFeeShares: 0n, proof: [], found: false };
  }

  const dump = await fetchRewardsTreeDump(gateway, cid);
  const tree = StandardMerkleTree.load<RewardsTreeValue>(dump);

  const operatorIdBig = BigInt(nodeOperatorId);
  const match = findOperatorLeaf(tree, operatorIdBig);
  if (!match) {
    logger.warn(`Operator ${operatorIdBig} not found in rewards tree; falling back to empty proof`);
    return { cumulativeFeeShares: 0n, proof: [], found: false };
  }

  const proof = tree.getProof(match.index);
  return { cumulativeFeeShares: match.cumulativeFeeShares, proof, found: true };
};
