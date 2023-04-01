export const groupByModuleId = <T extends { stakingModuleId: number }>(items: T[]): Record<number, T[]> => {
  return items.reduce((acc, item) => {
    const { stakingModuleId } = item;

    if (!acc[stakingModuleId]) {
      acc[stakingModuleId] = [];
    }

    acc[stakingModuleId].push(item);
    return acc;
  }, {} as Record<number, T[]>);
};
