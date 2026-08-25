import { Slider } from 'heroui-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { ReaderNativeProgressBarProps } from '@/components/reader-progress-bar.types';
import { snapReaderProgress } from '@/services/reader-page-progress';
import { useAppTheme } from '@/theme/app-theme';

export function ReaderNativeProgressBar({
  direction,
  displayMode = 'pages',
  disabled,
  onProgressChange,
  pageCurrent,
  pageTotal,
  progress,
  progressLabel,
  remainingText,
  step,
}: ReaderNativeProgressBarProps) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState(progress);
  const isReversed = direction === 'rtl';

  useEffect(() => setDraft(progress), [progress]);

  const displayedProgress = disabled ? 1 : isReversed ? 1 - draft : draft;
  const handleChange = (value: number | number[]) => {
    if (disabled) return;
    const displayed = typeof value === 'number' ? value : value[0] ?? 0;
    const next = isReversed ? 1 - displayed : displayed;
    const snapped = displayMode === 'percentage'
      ? clampProgress(next)
      : snapReaderProgress(next, pageTotal);
    setDraft(snapped);
    onProgressChange(snapped);
  };

  return (
    <View style={[styles.root, { width: Math.max(1, width - 32) }]}>
      <Slider
        animation="disable-all"
        isDisabled={disabled}
        maxValue={1}
        minValue={0}
        onChange={handleChange}
        step={step}
        style={styles.slider}
        value={displayedProgress}
      >
        <Slider.Track background={null} style={styles.track}>
          <Slider.Fill style={[styles.fill, { backgroundColor: colors.accent }]} />
          <Slider.Thumb
            animation="disabled"
            styles={{
              thumbKnob: { ...styles.thumbKnob, backgroundColor: colors.card },
            }}
          />
        </Slider.Track>
      </Slider>
      <Text style={[styles.currentPage, { color: colors.label }]}>
        {displayMode === 'percentage'
          ? progressLabel ?? `${Math.round(progress * 100)}%`
          : pageTotal > 0 ? `${pageCurrent} / ${pageTotal}` : ''}
      </Text>
      <Text style={[styles.remainingPages, { color: colors.secondaryLabel }]}>
        {remainingText}
      </Text>
    </View>
  );
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

const styles = StyleSheet.create({
  currentPage: {
    bottom: 0,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
  fill: {
    borderRadius: 1.5,
    height: 3,
  },
  remainingPages: {
    bottom: 0,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    position: 'absolute',
    right: 16,
  },
  root: {
    height: 40,
    position: 'relative',
  },
  slider: {
    height: 24,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 10,
  },
  thumbKnob: {
    borderRadius: 6,
    height: 12,
    shadowColor: '#000000',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 1.5,
    width: 18,
  },
  track: {
    height: 3,
    marginHorizontal: 12,
  },
});
