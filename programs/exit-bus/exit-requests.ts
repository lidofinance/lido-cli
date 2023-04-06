import { exitBusOracleContract, oracleConfigContract } from '@contracts';
import { FAR_FUTURE_EPOCH, fetchAllValidators, fetchBlock, ValidatorContainer } from '@providers';
import { getLatestBlock, getValidatorsMap } from '@utils';
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
  name: string,
  numvals: number,
  wc0x00: number,
  wc0x01: number,
  exitRequested: number,
  delayed: number,
  exited: number,
  exitedSlashed: number,
  withdrawable: number,
  withdrawn: number
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
  const validators = await fetchAllValidators(Number(slot));
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

  const dateObject = new Date(timestamp * 1000);
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    timeZone: 'UTC',
  };
  const intl = new Intl.DateTimeFormat('en-US', formatOptions);
  const requestTime = intl.format(dateObject);

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


export const groupRequestsByOperator = (items: { noId: number, operatorName:string, validator: number, requestTime: string, wcType: string, status: string, delayed: boolean }[]) => {
  return items.reduce<GroupedRequestsByOperator>((acc, item) => {
    acc[item.noId] = {
      name: item.operatorName,
      numvals: (acc[item.noId]?.numvals || 0) + 1,
      wc0x00: (item.wcType == '0x00' ? (acc[item.noId]?.wc0x00 + 1) || 1 : 0),
      wc0x01: (item.wcType == '0x01' ? (acc[item.noId]?.wc0x01 + 1) || 1 : 0),
      exitRequested: (item.status == 'active_ongoing' ? (acc[item.noId]?.exitRequested + 1) || 1 : (acc[item.noId]?.exitRequested) || 0),
      delayed: (item.delayed == true ? (acc[item.noId]?.delayed + 1) || 1 : (acc[item.noId]?.delayed) || 0),
      exited: ( (item.status == 'exited_unslashed' || item.status == 'withdrawal_done' || item.status == 'withdrawal_possible') ? (acc[item.noId]?.exited + 1) || 1 : (acc[item.noId]?.exited) || 0),
      exitedSlashed: (item.status == 'exited_slashed' ? (acc[item.noId]?.exitedSlashed + 1) || 1 : (acc[item.noId]?.exitedSlashed) || 0),
      withdrawable: (item.status == 'withdrawal_possible' ? (acc[item.noId]?.withdrawable + 1) || 1 : (acc[item.noId]?.withdrawable) || 0),
      withdrawn: (item.status == 'withdrawal_done' ? (acc[item.noId]?.withdrawn + 1) || 1 : (acc[item.noId]?.withdrawn) || 0),
    };
    
    return acc;
  }, [] as GroupedRequestsByOperator);
}
