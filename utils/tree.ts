import chalk from 'chalk';

export class TreeNode<T = unknown> {
  constructor(public data: T = {} as T, public children: TreeNode<T>[] = []) {}

  setData(data: T) {
    this.data = data;
  }

  setChildrenByIndex(index: number, node: TreeNode<T>) {
    this.children[index] = node;
  }

  getChildAtIndex(index: number): TreeNode<T> {
    return this.children[index];
  }
}

export const printTree = <T>(
  treeNode: TreeNode<T>,
  printer: (treeNode: T) => string[],
  indent = '',
  isLastChild = true,
) => {
  const { data, children } = treeNode;
  const lines = printer(data);
  const hasChildren = children.length > 0;

  const getLineIndent = (index: number) => {
    const isFirstLine = index === 0;

    if (hasChildren) {
      const lastChildSeparator = isFirstLine ? '└─┬─' : '  │ ';
      const childSeparator = isFirstLine ? '├─┬─' : '│ │ ';

      return isLastChild ? lastChildSeparator : childSeparator;
    } else {
      const lastChildSeparator = isFirstLine ? '└───' : '    ';
      const childSeparator = isFirstLine ? '├───' : '│   ';

      return isLastChild ? lastChildSeparator : childSeparator;
    }
  };

  lines.forEach((line, index) => {
    const separator = chalk.gray(getLineIndent(index));
    console.log(`${indent}${separator}${line}`);
  });

  indent += chalk.gray(isLastChild ? '  ' : '│ ');

  if (hasChildren) {
    children.forEach((child, index) => {
      const isLastChild = index === children.length - 1;
      printTree(child, printer, indent, isLastChild);
    });
  }
};
