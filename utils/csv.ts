import { writeFile } from 'fs/promises';
import { join } from 'path';

export const exportToCSV = async (data: Record<string, unknown>[], fileName: string, separator = ';') => {
  const csvTitle = Object.keys(data[0]).join(separator);
  const csvData = data.map((row) => Object.values(row).join(separator));
  const fileContent = [csvTitle].concat(csvData).join('\n');

  // TODO: ask for overwrite

  const filePath = join('reports', fileName);

  await writeFile(filePath, fileContent);
  console.log('file saved to', filePath);
};
