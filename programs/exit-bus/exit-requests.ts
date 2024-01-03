import { exitBusOracleContract, oracleConfigContract } from '@contracts';
import { FAR_FUTURE_EPOCH, fetchValidator, fetchBlock, ValidatorContainer } from '@providers';
import { formatDate, getLatestBlock, getValidatorsMap } from '@utils';
import { getNodeOperatorsMapByModule } from '../staking-module';

export type ExitRequest = {
  stakingModuleId: number;
  nodeOperatorId: number;
  operatorName: string;
  validatorIndex: number;
  validatorPubkey: string;
  timestamp: number;
};

export type ExitRequestWithValidator = ExitRequest & {
  secondsSinceRequest: number;
  isDelayed: boolean;
  validator: ValidatorContainer;
};

export type GroupedRequestsByOperator = {
  name: string;
  numvals: number;
  wc0x00: number;
  wc0x01: number;
  exitSignaledNYP: number;
  delayed: number;
  exited: number;
  exitedSlashed: number;
  withdrawable: number;
  withdrawn: number;
}[];

export const fetchLastExitRequests = async (forBlocks = 7200, toBlock?: number) => {
  if (!toBlock) {
    const latestBlock = await getLatestBlock();
    toBlock = latestBlock.number;
  }

  const fromBlock = toBlock - Number(forBlocks);

  const events = await exitBusOracleContract.queryFilter('ValidatorExitRequest', fromBlock, toBlock);
  const operatorsMap = await getNodeOperatorsMapByModule();

  return events.map((event) => {
    if (!('args' in event)) {
      throw new Error('Invalid event');
    }

    const stakingModuleId = Number(event.args.stakingModuleId);
    const nodeOperatorId = Number(event.args.nodeOperatorId);
    const validatorIndex = Number(event.args.validatorIndex);
    const timestamp = Number(event.args.timestamp);
    const validatorPubkey = String(event.args.validatorPubkey);
    const operatorName = operatorsMap[stakingModuleId][nodeOperatorId].name;

    return {
      stakingModuleId,
      nodeOperatorId,
      operatorName,
      validatorIndex,
      validatorPubkey,
      timestamp,
    };
  });
};

export const fetchLastExitRequestsDetailed = async (forBlocks = 7200) => {
  // fetch latest block on CL
  const block = await fetchBlock('head');
  const slot = block.message.slot;
  const blockNumber = block.message.body.execution_payload.block_number;
  const blockTimestamp = block.message.body.execution_payload.timestamp;

  // fetch delayed timeout
  const delayedTimeout = await fetchDelayedTimeout();

  // fetch exit requests from events on EL
  const requests = await fetchLastExitRequests(forBlocks, Number(blockNumber));

  // fetch validator from CL
  const validators = await Promise.all(
    requests.map(async (request) => await fetchValidator(request.validatorPubkey, Number(slot))),
  );
  const validatorsMap = getValidatorsMap(validators);

  // merge data
  return requests.map((request) => {
    const validator = validatorsMap[request.validatorPubkey];
    const isNotExiting = BigInt(validator.validator.exit_epoch) === FAR_FUTURE_EPOCH;
    const secondsSinceRequest = Number(blockTimestamp) - request.timestamp;
    const isDelayed = isNotExiting && secondsSinceRequest > delayedTimeout;

    return { ...request, secondsSinceRequest, isDelayed, validator };
  });
};

export const fetchDelayedTimeout = async () => {
  const secondsPerSlot = await exitBusOracleContract.SECONDS_PER_SLOT();
  const delayedTimeoutInSlots = await oracleConfigContract.get('VALIDATOR_DELAYED_TIMEOUT_IN_SLOTS');
  const delayedTimeoutInSeconds = Number(delayedTimeoutInSlots) * Number(secondsPerSlot);

  return delayedTimeoutInSeconds;
};

export const formatExitRequests = (requests: ExitRequest[]) => {
  return requests.map(formatExitRequest);
};

export const formatExitRequest = (request: ExitRequest) => {
  const { nodeOperatorId, operatorName, validatorIndex, timestamp } = request;
  const requestTime = formatDate(new Date(timestamp * 1000));

  return { noId: nodeOperatorId, operatorName, validator: validatorIndex, requestTime };
};

export const formatExitRequestsDetailed = (requests: ExitRequestWithValidator[]) => {
  return requests.map(formatConsoleExitRequestDetailed);
};

export const formatConsoleExitRequestDetailed = (request: ExitRequestWithValidator) => {
  const { validator, isDelayed } = request;
  const basicFields = formatExitRequest(request);

  const wcType = validator.validator.withdrawal_credentials.substring(0, 4);
  const status = validator.status;

  return { ...basicFields, wcType, status, delayed: isDelayed };
};

export const groupRequestsByOperator = (
  items: {
    noId: number;
    operatorName: string;
    validator: number;
    requestTime: string;
    wcType: string;
    status: string;
    delayed: boolean;
  }[],
) => {
  return items.reduce<GroupedRequestsByOperator>((acc, item) => {
    const defaultOperatorRequestsStat = {
      name: '', // need to initialize otherwise it will end up at the end of the object
      numvals: 0,
      wc0x00: 0,
      wc0x01: 0,
      exitSignaledNYP: 0,
      delayed: 0,
      exited: 0,
      exitedSlashed: 0,
      withdrawable: 0,
      withdrawn: 0,
    };

    const operatorRequestsStat = acc[item.noId] ?? { ...defaultOperatorRequestsStat };

    operatorRequestsStat.name = item.operatorName;
    operatorRequestsStat.numvals += 1;
    if (item.wcType == '0x00') operatorRequestsStat.wc0x00 += 1;
    if (item.wcType == '0x01') operatorRequestsStat.wc0x01 += 1;
    if (item.status == 'active_ongoing') operatorRequestsStat.exitSignaledNYP += 1;
    if (item.delayed == true) operatorRequestsStat.delayed += 1;
    if (item.status == 'exited_unslashed' || item.status == 'withdrawal_done' || item.status == 'withdrawal_possible')
      operatorRequestsStat.exited += 1;
    if (item.status == 'exited_slashed') operatorRequestsStat.exitedSlashed += 1;
    if (item.status == 'withdrawal_possible') operatorRequestsStat.withdrawable += 1;
    if (item.status == 'withdrawal_done') operatorRequestsStat.withdrawn += 1;

    acc[item.noId] = operatorRequestsStat;

    return acc;
  }, {} as GroupedRequestsByOperator);
};
