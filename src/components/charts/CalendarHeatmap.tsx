"use client";

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { CalendarHeatmapProps } from '@/lib/charts/chartTypes';

/**
 * CalendarHeatmap component using Apache ECharts.
 * Visualizes daily or weekly intensity across a calendar year.
 */
const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ 
  year, 
  data, 
  title,
  height = 280 
}) => {
  // Transform domain data to ECharts specific format: [string, number][]
  const echartsData = useMemo(() => {
    return data.map(item => [item.date, item.value]);
  }, [data]);

  const maxVal = useMemo(() => {
    return data.length > 0 ? Math.max(...data.map(d => d.value)) : 100;
  }, [data]);

  // ECharts configuration
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: '#334155',
      textStyle: {
        color: '#fff',
        fontSize: 12
      },
      formatter: (params: any) => {
        const [date, value] = params.value;
        return `
          <div style="padding: 4px">
            <b style="color: #94a3b8">${date}</b><br/>
            <span style="font-size: 14px; font-weight: bold; color: #fff">${value}</span>
            <span style="color: #64748b; font-size: 10px"> interest score</span>
          </div>
        `;
      }
    },
    visualMap: {
      min: 0,
      max: maxVal,
      type: 'piecewise',
      orient: 'horizontal',
      left: 'center',
      top: title ? 40 : 0,
      textStyle: {
        color: '#94a3b8',
        fontSize: 10
      },
      itemWidth: 12,
      itemHeight: 12,
      pieces: [
        { gt: 80, label: 'High (>80)', color: '#ef4444' },    // red-500
        { gt: 50, lte: 80, label: 'Growth (50-80)', color: '#f59e0b' }, // amber-500
        { gt: 20, lte: 50, label: 'Stable (20-50)', color: '#3b82f6' }, // blue-500
        { lte: 20, label: 'Low (<20)', color: '#1e3a8a' }      // blue-900
      ]
    },
    calendar: {
      top: title ? 100 : 60,
      left: 30,
      right: 30,
      bottom: 10,
      cellSize: ['auto', 13],
      range: year,
      itemStyle: {
        borderWidth: 0.5,
        borderColor: '#1e293b' // slate-800
      },
      yearLabel: { show: false },
      dayLabel: {
        color: '#64748b', // slate-500
        fontSize: 10,
        nameMap: 'en'
      },
      monthLabel: {
        color: '#64748b', // slate-500
        fontSize: 10,
        nameMap: 'en'
      },
      splitLine: {
        lineStyle: {
          color: '#334155', // slate-700
          width: 1,
          type: 'dashed'
        }
      }
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: echartsData,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  };

  if (title) {
    (option as any).title = {
      top: 0,
      left: 'center',
      text: title,
      textStyle: {
        color: '#f1f5f9',
        fontSize: 16,
        fontWeight: 'bold'
      }
    };
  }

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: '600px' }}>
        <ReactECharts 
          option={option} 
          style={{ height: height, width: '100%' }} 
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  );
};

export default CalendarHeatmap;
