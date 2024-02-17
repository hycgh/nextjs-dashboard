import type { GraphicComponentOption } from 'echarts';

export type CNode = {
  children: CNode[];
  index: number;
  level: number;
  count: number;
  distance: number;
  data: number[];
  x?: number;
  y?: number;
};

export function expandCluster(cnode: CNode) {
  let closerExpand: CNode[] = [];
  _expand(cnode);
  return closerExpand;
  function _expand(one: CNode) {
    if (one.data.length > 0) {
      closerExpand.push(one);
    } else {
      if (one.children[0].level > one.children[1].level) {
        _expand(one.children[1]);
        _expand(one.children[0]);
      } else if (one.children[0].level < one.children[1].level) {
        _expand(one.children[0]);
        _expand(one.children[1]);
      } else if (one.children[0].count > one.children[1].count) {
        _expand(one.children[1]);
        _expand(one.children[0]);
      } else {
        _expand(one.children[0]);
        _expand(one.children[1]);
      }
    }
  }
}

export function calculateClusterX(root: CNode) {
  if (root.children.length > 1) {
    root.children.forEach(calculateClusterX);
    if (root.children[0].x !== undefined && root.children[1].x !== undefined) {
      root.x = (root.children[0].x + root.children[1].x) / 2;
    }
  }
}

export function calculateClusterY(root: CNode) {
  if (root.children.length > 1) {
    root.children.forEach(calculateClusterY);
    if (root.children[0].y !== undefined && root.children[1].y !== undefined) {
      root.y = (root.children[0].y + root.children[1].y) / 2;
    }
  }
}

export function getRightLinesShapeByCluster(
  root: CNode,
  width: number,
  rightX: number,
) {
  let stepx = width / root.level;
  let lines: GraphicComponentOption[] = [];
  _deep(root);
  return lines;
  function _deep(node: CNode) {
    if (node.children.length == 0) return;

    lines.push(
      {
        type: 'line',
        shape: {
          x1: rightX - width + node.level * stepx,
          y1: node.children[0].y,
          x2: rightX - width + node.children[0].level * stepx,
          y2: node.children[0].y,
        },
      },
      {
        type: 'line',
        shape: {
          x1: rightX - width + node.level * stepx,
          y1: node.children[1].y,
          x2: rightX - width + node.children[1].level * stepx,
          y2: node.children[1].y,
        },
      },
      {
        type: 'line',
        shape: {
          x1: rightX - width + node.level * stepx,
          y1: node.children[0].y,
          x2: rightX - width + node.level * stepx,
          y2: node.children[1].y,
        },
      },
    );

    node.children.forEach(_deep);
  }
}

export function getTopLinesShapeByCluster(
  root: CNode,
  height: number,
  topY: number,
) {
  let stepY = height / root.level;
  let lines: GraphicComponentOption[] = [];
  _deep(root);
  return lines;
  function _deep(node: CNode) {
    if (node.children.length == 0) return;

    lines.push(
      {
        type: 'line',
        shape: {
          x1: node.children[0].x,
          y1: topY - node.level * stepY,
          x2: node.children[0].x,
          y2: topY - node.children[0].level * stepY,
        },
      },
      {
        type: 'line',
        shape: {
          x1: node.children[1].x,
          y1: topY - node.level * stepY,
          x2: node.children[1].x,
          y2: topY - node.children[1].level * stepY,
        },
      },
      {
        type: 'line',
        shape: {
          x1: node.children[0].x,
          y1: topY - node.level * stepY,
          x2: node.children[1].x,
          y2: topY - node.level * stepY,
        },
      },
    );

    node.children.forEach(_deep);
  }
}

export function doCluster(closers: CNode[], clusterType: number): CNode {
  let closersClone = closers.slice();
  while (closersClone.length > 1) {
    let minDistance = Infinity;
    let indexA = 0;
    let indexB = 0;
    for (let i = 0; i < closersClone.length; i++) {
      for (let j = i + 1; j < closersClone.length; j++) {
        let dis = 0;
        switch (clusterType) {
          case 1:
            dis = getMinClusterDistance(closersClone[i], closersClone[j]);
            break;
          case 2:
            dis = getMaxClusterDistance(closersClone[i], closersClone[j]);
            break;
          case 3:
            dis = getAverageClusterDistance(closersClone[i], closersClone[j]);
            break;
        }

        if (minDistance > dis) {
          minDistance = dis;
          indexA = i;
          indexB = j;
        }
      }
    }

    let a = closersClone[indexA];
    let b = closersClone[indexB];

    let newNode: CNode = {
      children: [a, b],
      level: Math.max(a.level, b.level) + 1,
      distance: minDistance,
      count: a.count + b.count,
      index: 0,
      data: [],
    };

    closersClone.splice(indexB, 1);
    closersClone.splice(indexA, 1);
    closersClone.push(newNode);
  }

  return closersClone[0];
}

/**
 * 获取聚类之间的最小距离
 * @param a
 * @param b
 * @returns
 */
function getMinClusterDistance(a: CNode, b: CNode): number {
  let datasA = getCNodeDatas(a);
  let datasB = getCNodeDatas(b);

  let minDistance = Infinity;
  for (let i = 0; i < datasA.length; i++) {
    for (let j = 0; j < datasB.length; j++) {
      let dis = getODis(datasA[i], datasB[j]);
      if (minDistance > dis) {
        minDistance = dis;
      }
    }
  }

  return minDistance;
}

/**
 * 获取聚类之间的最大距离
 * @param a
 * @param b
 * @returns
 */
function getMaxClusterDistance(a: CNode, b: CNode): number {
  let datasA = getCNodeDatas(a);
  let datasB = getCNodeDatas(b);

  let maxDistance = -Infinity;
  for (let i = 0; i < datasA.length; i++) {
    for (let j = 0; j < datasB.length; j++) {
      let dis = getODis(datasA[i], datasB[j]);
      if (maxDistance < dis) {
        maxDistance = dis;
      }
    }
  }

  return maxDistance;
}

/**
 * 获取聚类之间的平均距离
 * @param a
 * @param b
 * @returns
 */
function getAverageClusterDistance(a: CNode, b: CNode): number {
  let datasA = getCNodeDatas(a);
  let datasB = getCNodeDatas(b);

  let sum = 0;
  let count = 0;
  for (let i = 0; i < datasA.length; i++) {
    for (let j = 0; j < datasB.length; j++) {
      sum += getODis(datasA[i], datasB[j]);
      count += 1;
    }
  }

  return sum / count;
}

export function getCNodeDatas(cnode: CNode): number[][] {
  let result: number[][] = [];
  function deepGet(one: CNode) {
    if (one.data.length > 0) {
      result.push(one.data);
    } else {
      one.children.forEach(deepGet);
    }
  }
  deepGet(cnode);
  return result;
}

/**
 * 获取两组数据的欧式距离
 * @param a
 * @param b
 * @returns
 */
function getODis(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    let delta = a[i] - b[i];
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

export function randomMatrix(matrixBefore: number[][]): number[][] {
  let newMatrix: number[][] = [];
  matrixBefore.forEach((row) => {
    newMatrix.push(row.map(() => Math.round(Math.random() * 150) / 10));
  });
  return newMatrix;
}
