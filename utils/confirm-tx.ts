import prompts from 'prompts';

export const confirmTx = async () => {
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Confirm sending transaction?',
    initial: true,
  });

  return confirm;
};
