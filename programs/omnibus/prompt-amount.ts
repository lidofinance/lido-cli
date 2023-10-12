import prompts from 'prompts';

export const promptAmountOfCalls = async () => {
  const { amount } = await prompts({
    type: 'number',
    name: 'amount',
    message: 'Enter amount of calls',
  });

  return amount;
};
