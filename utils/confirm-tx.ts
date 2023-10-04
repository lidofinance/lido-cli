import prompts from 'prompts';

export const confirmTx = async () => {
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'confirm sending transaction?',
    initial: true,
  });

  return confirm;
};
