import { join } from 'path';
import { writeToFile } from './write-to-file';

export const exportToCSV = async (data: Record<string, unknown>[], fileName: string, separator = ';') => {
  const csvTitle = Object.keys(data[0]).join(separator);
  const csvData = data.map((row) => Object.values(row).join(separator));
  const fileContent = [csvTitle].concat(csvData).join('\n');

  const filePath = join('reports', fileName);
  await writeToFile(filePath, fileContent);
};
