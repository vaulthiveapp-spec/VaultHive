import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VaultColors } from '../styles/DesignSystem';
import { scale, getFontSize, getSpacing, isSmallDevice } from '../utils/responsive';

const OptimizedChart = memo(({ data, isSmall }) => {
  const chartHeight = isSmall ? scale(130) : scale(156);
  const barMaxHeight = chartHeight * 0.7;

  const normalizedData = useMemo(() => {
    const maxValue = Math.max(...data.incomeData, ...data.expenseData);
    return {
      income: data.incomeData.map(val => (val / maxValue) * barMaxHeight),
      expense: data.expenseData.map(val => (val / maxValue) * barMaxHeight),
    };
  }, [data, barMaxHeight]);

  const renderGridLines = useMemo(() => {
    return [...Array(4)].map((_, i) => (
      <View 
        key={i} 
        style={[
          styles.chartGridLine, 
          { top: `${20 + i * 20}%` }
        ]} 
      />
    ));
  }, []);

  const renderBars = useMemo(() => {
    return data.labels.map((label, index) => (
      <View key={index} style={styles.barGroup}>
        <View style={[
          styles.bar, 
          { 
            height: normalizedData.income[index],
            backgroundColor: VaultColors.brandGold
          }
        ]} />
        <View style={[
          styles.bar, 
          { 
            height: normalizedData.expense[index],
            backgroundColor: VaultColors.textPrimary
          }
        ]} />
      </View>
    ));
  }, [normalizedData, data.labels]);

  const renderXAxisLabels = useMemo(() => {
    return data.labels.map((label, index) => (
      <Text 
        key={index} 
        style={[styles.xAxisLabel, isSmall && styles.xAxisLabelSmall]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    ));
  }, [data.labels, isSmall]);

  return (
    <View style={[styles.chartArea, { height: chartHeight }]}>
      <View style={styles.yAxis}>
        <Text style={[styles.yAxisLabel, isSmall && styles.yAxisLabelSmall]}>15k</Text>
        <Text style={[styles.yAxisLabel, isSmall && styles.yAxisLabelSmall]}>10k</Text>
        <Text style={[styles.yAxisLabel, isSmall && styles.yAxisLabelSmall]}>5k</Text>
        <Text style={[styles.yAxisLabel, isSmall && styles.yAxisLabelSmall]}>1k</Text>
      </View>
      
      <View style={styles.chartBars}>
        {renderGridLines}
        <View style={styles.barsContainer}>
          {renderBars}
        </View>
      </View>
      
      <View style={styles.xAxis}>
        {renderXAxisLabels}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  chartArea: {
    position: 'relative',
    marginBottom: getSpacing(32),
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '85%',
    justifyContent: 'space-between',
    paddingVertical: getSpacing(10),
  },
  yAxisLabel: {
    color: VaultColors.brandGoldSoft,
    fontSize: getFontSize(14),
    fontFamily: 'League Spartan',
    fontWeight: '400',
  },
  yAxisLabelSmall: {
    fontSize: getFontSize(12),
  },
  chartBars: {
    marginLeft: getSpacing(30),
    height: '85%',
    position: 'relative',
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: VaultColors.brandGoldSoft,
    opacity: 0.3,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100%',
    paddingHorizontal: getSpacing(19),
  },
  barGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: scale(6),
  },
  bar: {
    width: scale(6),
    borderTopLeftRadius: scale(31),
    borderTopRightRadius: scale(31),
    minHeight: scale(2),
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: getSpacing(8),
    paddingHorizontal: getSpacing(30),
  },
  xAxisLabel: {
    color: VaultColors.textMuted,
    fontSize: getFontSize(14),
    fontFamily: 'League Spartan',
    fontWeight: '400',
    textAlign: 'center',
    flex: 1,
  },
  xAxisLabelSmall: {
    fontSize: getFontSize(12),
  },
});

OptimizedChart.displayName = 'OptimizedChart';

export default OptimizedChart;
