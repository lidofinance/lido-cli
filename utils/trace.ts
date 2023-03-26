import chalk from 'chalk';
import { getCachedAddressMap } from '@configs';
import { AbiCoder, ErrorDescription, formatEther, TransactionDescription } from 'ethers';
import { getAllAbi } from './abi';
import { TreeNode } from './tree';
import { stringify } from './stringify';

export type TraceEntity = {
  traceAddress: number[];
  subtraces: number;
  action: {
    callType: string;
    from: string;
    gas: string;
    input: string;
    to: string;
    value: string;
  };
  result?: {
    gasUsed: string;
    output: string;
  };
  error?: string;
  type: string;
};

export type CleanedTraceEntity = Omit<TraceEntity, 'traceAddress' | 'subtraces'>;

export const buildTraceTree = <T = CleanedTraceEntity>(trace: TraceEntity[]) => {
  const treeRoot = new TreeNode<T>();

  trace.forEach((traceEntity) => {
    const { traceAddress, action, result, error, type } = traceEntity;
    let currentNode = treeRoot;

    traceAddress.forEach((nodeIndex) => {
      let childNode = currentNode.getChildAtIndex(nodeIndex);

      if (!childNode) {
        childNode = new TreeNode<T>();
      }

      currentNode.setChildrenByIndex(nodeIndex, childNode);
      currentNode = childNode;
    });

    currentNode.setData({ action, result, error, type } as T);
  });

  return treeRoot;
};

const title = chalk.yellow;
const method = chalk.blue;
const label = chalk.gray;
const error = chalk.red;
const contract = chalk.green;

export const formatTraceNode = (traceEntity: CleanedTraceEntity): string[] => {
  const { type } = traceEntity;

  if (type === 'call') return formatTraceCall(traceEntity);
  return formatTraceUnknown(traceEntity);
};

export const formatTraceCall = (traceEntity: CleanedTraceEntity): string[] => {
  const { action, result, error: traceError } = traceEntity;
  const nodeTitle = title(action.callType);

  const txDescription = detectTxDescription(action.input, action.value);

  const callFrom = label('from: ') + detectAddress(action.from);
  const callTo = label('to: ') + detectAddress(action.to);
  const callInput = label('input: ') + formatCallInput(action.input, txDescription);
  const callArgs = txDescription ? label('args: ') + formatArgs(txDescription) : '';

  const callValue = label('value: ') + `${formatEther(action.value)} ETH`;
  const callGas = label('gas: ') + formatCallGas(action.gas, result?.gasUsed);

  const baseFields = [nodeTitle, callInput, callArgs, callFrom, callTo, callValue, callGas].filter((v) => v);

  const callResult = result?.output ? label('result: ') + formatCallResult(result.output, txDescription) : '';
  const callError = traceError ? label('error: ') + error(traceError) : '';

  if (result && traceError) {
    const errorDescription = detectErrorDescription(result.output);
    const callResult = label('result: ') + formatError(result.output, errorDescription);
    return [...baseFields, callResult, callError];
  }

  return [...baseFields, callResult, callError];
};

export const formatTraceUnknown = (traceEntity: CleanedTraceEntity): string[] => {
  const nodeTitle = title(traceEntity.type);
  return [nodeTitle];
};

export const formatArgs = (tx: TransactionDescription) => {
  return method(stringify(tx.args.toObject()));
};

export const detectAddress = (address: string) => {
  const addressMap = getCachedAddressMap();
  const loweredAddress = address.toLowerCase();
  const contractName = addressMap[loweredAddress];

  return contract(contractName || address);
};

export const formatCallInput = (input: string, tx?: TransactionDescription) => {
  if (!tx) return input;
  return method(`${tx.fragment.name}(${tx.args})`);
};

export const formatCallResult = (result: string, tx?: TransactionDescription) => {
  if (!tx) return result;

  const abiCoder = AbiCoder.defaultAbiCoder();
  try {
    return abiCoder.decode(tx.fragment.outputs, result);
  } catch (_error) {
    return error(`Unparsed ${result}`);
  }
};

export const formatError = (result: string, errorDescription?: ErrorDescription) => {
  if (!errorDescription) return result;
  return error(`${errorDescription.fragment.name}(${errorDescription.args})`);
};

export const formatCallGas = (gas: string, gasUsed?: string) => {
  if (gasUsed == null) return Number(gas);
  return Number(gas) + ', used: ' + Number(gasUsed);
};

export const detectTxDescription = (data: string, value: string) => {
  const tx = { data, value };
  const abi = getAllAbi();

  const parsed = abi.find(({ iface }) => iface.parseTransaction(tx));
  return parsed?.iface.parseTransaction(tx) ?? undefined;
};

export const detectErrorDescription = (reason: string) => {
  const abi = getAllAbi();

  const parsed = abi.find(({ iface }) => iface.parseError(reason));
  return parsed?.iface.parseError(reason) ?? undefined;
};
