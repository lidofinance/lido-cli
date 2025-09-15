import { ParamType, LogDescription } from 'ethers';

export const formatLog = (log: LogDescription) => {
  const signature = `${log.name}(${log.fragment.inputs.map((input) => formatParam(input)).join(', ')})`;
  const args = log.args.toArray();
  const topic = log.topic;

  return {
    topic,
    signature,
    args,
  };
};

export const formatParam = (param: ParamType) => {
  const { type: t, indexed, name } = param;

  if (indexed) {
    return `${t} indexed ${name}`;
  } else {
    return `${t} ${name}`;
  }
};
