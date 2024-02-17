'use client';

import * as echarts from 'echarts';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  CNode,
  calculateClusterX,
  calculateClusterY,
  doCluster,
  expandCluster,
  getRightLinesShapeByCluster,
  getTopLinesShapeByCluster,
  randomMatrix,
} from '../lib/cluster/utils';

export default function Page() {
  const [clusterType, setClusterType] = useState(1);
  const [genes, setGenes] = useState(['G1', 'G2', 'G3', 'G4']);
  const [samples, setSamples] = useState(['s1', 's2', 's3', 's4']);

  const [matrix, setMatrix] = useState([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);

  const [editState, setEditState] = useState([
    [false, false, false, false],
    [false, false, false, false],
    [false, false, false, false],
    [false, false, false, false],
  ]);

  const initZoomGenes: string[] = [];
  const initZoomSamples: string[] = [];
  const initZoomMatrix: number[][] = [];
  const [zoomMatrix, setZoomMatrix] = useState(initZoomMatrix);
  const [zoomGenes, setZoomGenes] = useState(initZoomGenes);
  const [zoomSamples, setZoomSamples] = useState(initZoomSamples);

  const clusterMatrix = useCallback(() => {
    return zoomMatrix.length > 0 ? zoomMatrix : matrix;
  }, [zoomMatrix, matrix]);

  const clusterGenes = useCallback(() => {
    return zoomGenes.length > 0 ? zoomGenes : genes;
  }, [zoomGenes, genes]);

  const clusterSamples = useCallback(() => {
    return zoomSamples.length > 0 ? zoomSamples : samples;
  }, [zoomSamples, samples]);

  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMatrix((m) => randomMatrix(m));
  }, []);

  useEffect(() => {
    setZoomGenes([]);
    setZoomSamples([]);
    setZoomMatrix([]);
  }, [matrix, clusterType]);

  useEffect(() => {
    console.log('echarts init');
    var myChart = echarts.init(container.current);

    let minValue = Infinity;
    let maxValue = -Infinity;
    let _matrix = clusterMatrix();
    let _genes = clusterGenes();
    let _samples = clusterSamples();

    for (let i = 0; i < _matrix.length; i++) {
      for (let j = 0; j < _matrix[i].length; j++) {
        if (minValue > _matrix[i][j]) {
          minValue = _matrix[i][j];
        }
        if (maxValue < _matrix[i][j]) {
          maxValue = _matrix[i][j];
        }
      }
    }

    //行聚类
    let clusterHorizontal: CNode[] = _genes.map((row, index) => {
      return {
        children: [],
        index: index,
        level: 0,
        count: 1,
        distance: 0,
        data: _matrix[index].slice(),
      };
    });

    let rootHorizontal = doCluster(clusterHorizontal, clusterType);
    let sortClusterHorizontal = expandCluster(rootHorizontal);

    //列聚类
    let clusterVertical: CNode[] = _samples.map((col, index) => {
      return {
        children: [],
        index: index,
        level: 0,
        count: 1,
        distance: 0,
        data: _matrix.map((row, k) => {
          return sortClusterHorizontal[k].data[index];
        }),
      };
    });

    let rootVertical = doCluster(clusterVertical, clusterType);
    let sortClusterVertical = expandCluster(rootVertical);

    minValue = Math.floor(minValue);
    maxValue = Math.ceil(maxValue);

    let width = myChart.getWidth();
    let height = myChart.getHeight();
    let itemHeight = (height - 200) / _genes.length;
    let startY = itemHeight / 2 + 100;

    let itemWidth = (width - 200) / _samples.length;
    let startX = itemWidth / 2 + 100;

    const data: number[][] = [];

    for (let i = 0; i < sortClusterHorizontal.length; i++) {
      for (let j = 0; j < sortClusterHorizontal[i].data.length; j++) {
        data.push([j, i, sortClusterVertical[j].data[i]]);
      }
    }

    sortClusterHorizontal.forEach((oneNode) => {
      oneNode.y = startY;
      startY += itemHeight;
    });

    sortClusterVertical.forEach((oneNode) => {
      oneNode.x = startX;
      startX += itemWidth;
    });

    calculateClusterX(rootVertical);
    calculateClusterY(rootHorizontal);

    myChart.setOption({
      tooltip: {
        position: 'top',
        formatter: function (p: any) {
          return '' + p.data[2];
        },
      },
      toolbox: {
        show: true,
        feature: {
          dataZoom: {},
          restore: {},
          saveAsImage: {},
        },
      },
      grid: {
        left: '100px',
        right: '100px',
        top: '100px',
        bottom: '100px',
      },
      xAxis: {
        type: 'category',
        data: sortClusterVertical.map((one) => _samples[one.index]),
        splitArea: {
          show: true,
        },
      },
      yAxis: {
        type: 'category',
        data: sortClusterHorizontal.map((one) => _genes[one.index]),
        splitArea: {
          show: true,
        },
      },
      visualMap: {
        min: minValue,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5px',
      },
      graphic: getRightLinesShapeByCluster(
        rootHorizontal,
        90,
        width - 10,
      ).concat(getTopLinesShapeByCluster(rootVertical, 90, 100)),
      series: [
        {
          name: 'Punch Card',
          type: 'heatmap',
          data,
          label: {
            show: true,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    } satisfies echarts.EChartsOption);

    myChart.on('datazoom', function (params: any) {
      console.log(params);
      if (
        params &&
        params.batch &&
        params.batch[0] &&
        params.batch[0].startValue !== undefined
      ) {
        let tempMatrix: number[][] = [];

        for (
          let i = params.batch[1].startValue;
          i <= params.batch[1].endValue;
          i++
        ) {
          let tempRow: number[] = [];
          for (
            let j = params.batch[0].startValue;
            j <= params.batch[0].endValue;
            j++
          ) {
            tempRow.push(sortClusterVertical[j].data[i]);
          }
          tempMatrix.push(tempRow);
        }
        setZoomGenes(
          sortClusterHorizontal
            .map((one) => _genes[one.index])
            .slice(params.batch[1].startValue, params.batch[1].endValue + 1),
        );
        setZoomSamples(
          sortClusterVertical
            .map((one) => _samples[one.index])
            .slice(params.batch[0].startValue, params.batch[0].endValue + 1),
        );
        setZoomMatrix(tempMatrix);
      } else {
        setZoomGenes([]);
        setZoomSamples([]);
        setZoomMatrix([]);
      }
    });
    myChart.on('restore', (e) => {
      setZoomGenes([]);
      setZoomSamples([]);
      setZoomMatrix([]);
    });
    return () => {
      myChart.dispose();
    };
  }, [
    matrix,
    genes,
    samples,
    clusterType,
    clusterMatrix,
    clusterGenes,
    clusterSamples,
  ]);

  const addSample = () => {
    if (samples.length >= 20) return;
    let newSamples = samples.slice();
    newSamples.push('s' + (samples.length + 1));
    setSamples(newSamples);

    let newMatrix = matrix.map((row) => {
      let newRow = row.slice();
      newRow.push(Math.round(Math.random() * 150) / 10);
      return newRow;
    });
    setMatrix(newMatrix);

    let newEditState = editState.map((row) => {
      let newRow = row.slice();
      newRow.push(false);
      return newRow;
    });
    setEditState(newEditState);
  };

  const deleteSample = () => {
    if (samples.length <= 2) return;
    let newSamples = samples.slice();
    newSamples.pop();
    setSamples(newSamples);

    let newMatrix = matrix.map((row) => {
      let newRow = row.slice();
      newRow.pop();
      return newRow;
    });
    setMatrix(newMatrix);

    let newEditState = editState.map((row) => {
      let newRow = row.slice();
      newRow.pop();
      return newRow;
    });
    setEditState(newEditState);
  };

  const addGene = () => {
    if (genes.length >= 10) return;
    let newGenes = genes.slice();
    newGenes.push('G' + (genes.length + 1));
    setGenes(newGenes);

    let newMatrix = matrix.slice();
    newMatrix.push(samples.map(() => Math.round(Math.random() * 150) / 10));
    setMatrix(newMatrix);

    let newEditState = editState.slice();
    newEditState.push(samples.map(() => false));
    setEditState(newEditState);
  };

  const deleteGene = () => {
    if (genes.length <= 2) return;
    let newGenes = genes.slice();
    newGenes.pop();
    setGenes(newGenes);

    let newMatrix = matrix.slice();
    newMatrix.pop();
    setMatrix(newMatrix);

    let newEditState = editState.slice();
    newEditState.pop();
    setEditState(newEditState);
  };

  const changeClusterType = (e: ChangeEvent<HTMLInputElement>) => {
    setClusterType(Number(e.target.value));
  };

  return (
    <>
      <div className=" mb-3 bg-gray-50 p-3 text-center">
        精智未来作业：层次聚类热力图
      </div>
      <div className="flex w-full bg-gray-50 text-center">
        <div className="flex w-1/2 flex-col">
          <h3 className="border-2 border-white p-3">
            数据
            <a
              className=" ml-3 cursor-pointer text-cyan-400"
              onClick={() => {
                setMatrix(randomMatrix(matrix));
              }}
            >
              刷新
            </a>
          </h3>
          <div className="flex w-full flex-1">
            <table className="flex-1 bg-white">
              <thead>
                <tr>
                  <th>基因\样本</th>
                  {samples.map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {genes.map((g, index) => (
                  <tr key={g}>
                    <td>{g}</td>
                    {matrix[index].map((v, k) => (
                      <td
                        className="relative cursor-text border border-dashed border-transparent hover:border-solid hover:border-gray-200"
                        key={g + k}
                        onClick={(e) => {
                          console.log(e);
                          if (e.button === 0 && !editState[index][k]) {
                            console.log(e);
                            setEditState(
                              editState.map((row, ri) => {
                                if (ri == index) {
                                  let newRow = row.slice();
                                  newRow[k] = true;
                                  return newRow;
                                } else {
                                  return row;
                                }
                              }),
                            );
                          }
                        }}
                      >
                        {v}
                        {editState[index][k] && (
                          <input
                            type="number"
                            className="absolute left-0 top-0 h-full w-full p-0 text-center"
                            value={v}
                            autoFocus
                            onChange={(e) => {
                              let newMatrix = matrix.map((row, ri) => {
                                if (ri == index) {
                                  let newRow = row.slice();
                                  newRow[k] = Number(e.target.value);
                                  return newRow;
                                } else {
                                  return row;
                                }
                              });
                              setMatrix(newMatrix);
                            }}
                            onBlur={(e) => {
                              setEditState(
                                editState.map((row) => {
                                  return row.map(() => false);
                                }),
                              );
                            }}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex w-10 flex-col text-center">
              <button
                onClick={addSample}
                className="flex-1 border-2 border-white bg-gray-200 hover:bg-cyan-400"
              >
                +
              </button>
              <button
                onClick={deleteSample}
                className="flex-1 border-2 border-white bg-gray-200 hover:bg-cyan-400"
              >
                -
              </button>
            </div>
          </div>
          <div className="mr-10 flex h-10">
            <button
              onClick={addGene}
              className="flex-1 border-2 border-white bg-gray-200 hover:bg-cyan-400"
            >
              +
            </button>
            <button
              onClick={deleteGene}
              className="flex-1 border-2 border-white bg-gray-200 hover:bg-cyan-400"
            >
              -
            </button>
          </div>
        </div>
        <div className="w-1/2">
          <h3 className="border-2 border-white p-3">热力图</h3>
          <div ref={container} className="h-96 border-2 border-white"></div>
        </div>
      </div>
      <div className="flex gap-4 border-2 border-white bg-gray-50 p-3">
        <div>聚类算法：</div>
        <div className="flex items-center">
          <input
            id="cluster-min-dis"
            type="radio"
            name="cluster-way"
            className="h-4 w-4 cursor-pointer"
            value="1"
            checked={clusterType == 1}
            onChange={changeClusterType}
          />
          <label htmlFor="cluster-min-dis" className="ml-2 cursor-pointer">
            最小距离
          </label>
        </div>
        <div className="flex items-center">
          <input
            id="cluster-max-dis"
            type="radio"
            name="cluster-way"
            className="h-4 w-4 cursor-pointer"
            value="2"
            checked={clusterType == 2}
            onChange={changeClusterType}
          />
          <label htmlFor="cluster-max-dis" className="ml-2 cursor-pointer">
            最大距离
          </label>
        </div>
        <div className="flex items-center">
          <input
            id="cluster-avarage-dis"
            type="radio"
            name="cluster-way"
            className="h-4 w-4 cursor-pointer"
            value="3"
            checked={clusterType == 3}
            onChange={changeClusterType}
          />
          <label htmlFor="cluster-avarage-dis" className="ml-2 cursor-pointer">
            平均距离
          </label>
        </div>
      </div>
    </>
  );
}
