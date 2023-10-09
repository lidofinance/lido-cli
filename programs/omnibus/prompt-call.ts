import { gray, bold, green } from 'chalk';
import prompts from 'prompts';

export const printCallExample = () => {
  console.log('');
  console.log(bold('enter calls one by one'));
  console.log(`format: ${gray('address "method_signature(uint256,string)" arg1 arg2')}`);
  console.log(
    `example: ${gray(
      `0x595F64Ddc3856a3b5Ff4f4CC1d1fb4B46cFd2bAC 'setNodeOperatorStakingLimit(uint256,uint64)' 0 150`,
    )}`,
  );
  console.log('');
};

export const printCallsSuccess = () => {
  console.log(green('filling the list of calls is completed'));
  console.log('');
};

export const promptMethodCall = async (index: number) => {
  const { methodCall } = await prompts({
    type: 'text',
    name: 'methodCall',
    message: `enter call ${index + 1}`,
  });

  return methodCall;
};
