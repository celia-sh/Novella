import { Image } from 'expo-image';
import { IconChevronLeft, IconChevronRight, IconCoins, IconPhotoOff, IconRefresh } from '@tabler/icons-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OwnedShopItem, ShopItem, SignInCalendar } from '@novella/api-client';
import { COMIC_QUOTA_ITEM_KEY, SIGN_MAKEUP_ITEM_KEY } from '@novella/client-core';

import { showAlert } from '@/components/native-alert-dialog';
import { useShop } from '@/hooks/use-shop';
import { useAppLocale } from '@/localization/localization-provider';
import { shop as shopUseCase, profile as profileUseCase } from '@/services/client';
import { resolveShopImageUrl } from '@/services/shop-images';
import { resolveShopPurchaseAvailability } from '@/services/shop-purchase';
import {
  formatUtcDate,
  markSignInCalendarDate,
  utcDateAtNoon,
} from '@/services/shop-dates';
import {
  createThemedStyles,
  resolveAccentHex,
  resolveOnAccentHex,
  useAppTheme,
} from '@/theme/app-theme';

export function ShopSettingsScreen() {
  const insets = useSafeAreaInsets();
  const locale = useAppLocale();
  const styles = useShopSettingsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const { error, reload, snapshot, status } = useShop();
  const [buyingKeys, setBuyingKeys] = useState<ReadonlySet<string>>(new Set());
  const [usingQuota, setUsingQuota] = useState(false);
  const [makeupDate, setMakeupDate] = useState(() => utcDateAtNoon(-1));
  const [usingMakeup, setUsingMakeup] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => utcDateAtNoon(0));
  const [calendar, setCalendar] = useState<SignInCalendar | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [calendarReload, setCalendarReload] = useState(0);
  const numberFormatter = new Intl.NumberFormat(locale);
  const calendarWeekdayLabels = [
    t('shop.calendar.weekdays.sunday'),
    t('shop.calendar.weekdays.monday'),
    t('shop.calendar.weekdays.tuesday'),
    t('shop.calendar.weekdays.wednesday'),
    t('shop.calendar.weekdays.thursday'),
    t('shop.calendar.weekdays.friday'),
    t('shop.calendar.weekdays.saturday'),
  ];
  const calendarYear = calendarMonth.getUTCFullYear();
  const calendarMonthNumber = calendarMonth.getUTCMonth() + 1;
  const signedDates = useMemo(
    () => new Set((calendar?.days ?? []).map((day) => day.date.slice(0, 10))),
    [calendar],
  );
  const calendarCells = useMemo(
    () => createCalendarCells(calendarYear, calendarMonthNumber),
    [calendarMonthNumber, calendarYear],
  );
  const selectedMakeupDate = formatUtcDate(makeupDate);
  const hasMakeupCard = snapshot?.ownedItems.some((item) => item.key === SIGN_MAKEUP_ITEM_KEY) ?? false;
  const selectedDateIsAvailable = calendar !== null
    && isMakeupDateInWindow(selectedMakeupDate)
    && !signedDates.has(selectedMakeupDate);
  const calendarMonthStart = startOfUtcMonth(calendarMonth);
  const minimumCalendarMonth = startOfUtcMonth(utcDateAtNoon(-30));
  const currentCalendarMonth = startOfUtcMonth(utcDateAtNoon(0));
  const canGoPreviousMonth = calendarMonthStart.getTime() > minimumCalendarMonth.getTime();
  const canGoNextMonth = calendarMonthStart.getTime() < currentCalendarMonth.getTime();

  useEffect(() => {
    if (!hasMakeupCard) {
      setCalendar(null);
      setCalendarStatus('idle');
      return;
    }
    let cancelled = false;
    setCalendar(null);
    setCalendarStatus('loading');
    void shopUseCase.loadSignInCalendar(calendarYear, calendarMonthNumber)
      .then((next) => {
        if (cancelled) return;
        setCalendar(next);
        setCalendarStatus('ready');
        setMakeupDate((current) => {
          const currentDate = formatUtcDate(current);
          if (isCalendarDateAvailable(currentDate, next)) return current;
          const firstAvailable = findFirstAvailableDate(next);
          return firstAvailable ? parseUtcDate(firstAvailable) : current;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCalendarStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [calendarMonthNumber, calendarReload, calendarYear, hasMakeupCard]);

  function confirmPurchase(item: ShopItem) {
    const availability = resolveShopPurchaseAvailability(item);
    if (
      availability.state === 'unavailable' ||
      availability.state === 'limitReached' ||
      buyingKeys.has(item.key)
    ) return;

    showAlert(
      t('shop.confirmTitle'),
      t('shop.confirmMessage', {
        name: item.name,
        price: numberFormatter.format(item.price),
      }),
      [
        { style: 'cancel', text: tCommon('actions.cancel') },
        {
          text: tCommon('actions.confirm'),
          onPress: () => {
            setBuyingKeys((current) => new Set(current).add(item.key));
            // The item projection and the growth delta are the success feedback.
            void shopUseCase.buy(item.key)
              .catch((purchaseError) => {
                showAlert(
                  t('shop.failedTitle'),
                  purchaseError instanceof Error
                    ? purchaseError.message
                    : tCommon('states.unknownError'),
                );
              })
              .finally(() => {
                setBuyingKeys((current) => {
                  const next = new Set(current);
                  next.delete(item.key);
                  return next;
                });
              });
          },
        },
      ],
    );
  }

  function confirmMakeup() {
    if (usingMakeup || !snapshot || !selectedDateIsAvailable) return;
    const date = selectedMakeupDate;
    showAlert(
      t('shop.makeupConfirmTitle'),
      t('shop.makeupConfirmMessage', { date }),
      [
        { style: 'cancel', text: tCommon('actions.cancel') },
        {
          text: tCommon('actions.confirm'),
          onPress: () => {
            setUsingMakeup(true);
            void shopUseCase.useSignMakeupCard(date)
              .then(async (outcome) => {
                setCalendar((current) => current
                  ? markSignInCalendarDate(
                    current,
                    date,
                    outcome.result.streak,
                    outcome.result.reward,
                  )
                  : current);
                setCalendarReload((current) => current + 1);
                await profileUseCase.load().catch(() => undefined);
              })
              .catch((makeupError) => {
                showAlert(
                  t('shop.makeupFailedTitle'),
                  makeupError instanceof Error
                    ? makeupError.message
                    : tCommon('states.unknownError'),
                );
              })
              .finally(() => setUsingMakeup(false));
          },
        },
      ],
    );
  }

  function confirmQuotaUse() {
    if (
      usingQuota ||
      !snapshot?.ownedItems.some((item) => item.key === COMIC_QUOTA_ITEM_KEY)
    ) return;
    showAlert(t('shop.quotaConfirmTitle'), t('shop.quotaConfirmMessage'), [
      { style: 'cancel', text: tCommon('actions.cancel') },
      {
        text: tCommon('actions.confirm'),
        onPress: () => {
          setUsingQuota(true);
          void shopUseCase.useComicQuotaCard()
            .then(async (outcome) => {
              await profileUseCase.load().catch(() => undefined);
              showAlert(
                t('shop.quotaSuccessTitle'),
                t('shop.quotaSuccessMessage', {
                  granted: numberFormatter.format(outcome.result.granted),
                  quota: numberFormatter.format(outcome.result.quota),
                }),
              );
            })
            .catch((quotaError) => {
              showAlert(
                t('shop.quotaFailedTitle'),
                quotaError instanceof Error
                  ? quotaError.message
                  : tCommon('states.unknownError'),
              );
            })
            .finally(() => setUsingQuota(false));
        },
      },
    ]);
  }

  function shiftCalendarMonth(delta: number) {
    if ((delta < 0 && !canGoPreviousMonth) || (delta > 0 && !canGoNextMonth)) return;
    setMakeupDate(utcDateAtNoon(-1));
    setCalendarMonth((current) => new Date(Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth() + delta,
      1,
      12,
    )));
  }

  function selectCalendarDay(day: number) {
    if (!calendar) return;
    const date = formatCalendarDate(calendarYear, calendarMonthNumber, day);
    if (!isCalendarDateAvailable(date, calendar)) return;
    setMakeupDate(parseUtcDate(date));
  }

  if (!snapshot) {
    const loading = status === 'loading' || status === 'idle';
    return (
      <View style={styles.stateRoot}>
        {loading ? <ActivityIndicator color={resolveAccentHex(colors.accent)} /> : null}
        <Text style={styles.stateTitle}>{loading ? t('shop.loading') : t('shop.loadFailed')}</Text>
        {!loading ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void reload()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <IconRefresh color={resolveAccentHex(colors.accent)} size={18} strokeWidth={2} />
            <Text style={styles.retryLabel}>{t('shop.retry')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(36, insets.bottom + 24) }]}
      refreshControl={(
        <RefreshControl
          onRefresh={() => void reload()}
          refreshing={status === 'refreshing'}
          tintColor={resolveAccentHex(colors.accent)}
        />
      )}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <View style={styles.balanceCard}>
        <View style={styles.balanceIcon}>
          <IconCoins color={resolveOnAccentHex(colors.accent)} size={28} strokeWidth={2} />
        </View>
        <View style={styles.balanceCopy}>
          <Text style={styles.sectionEyebrow}>{t('shop.sections.balance')}</Text>
          <Text style={styles.balanceValue}>
            {t('shop.balanceValue', { balance: numberFormatter.format(snapshot.coin) })}
          </Text>
        </View>
      </View>

      {error ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void reload()}
          style={({ pressed }) => [styles.inlineError, pressed && styles.pressed]}
        >
          <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
          <Text style={styles.retryLabel}>{t('shop.retry')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('shop.sections.store')}</Text>
        {snapshot.items.length === 0 ? (
          <EmptyCard label={t('shop.emptyStore')} />
        ) : (
          snapshot.items.map((item) => (
            <ShopItemCard
              buying={buyingKeys.has(item.key)}
              item={item}
              key={item.key}
              numberFormatter={numberFormatter}
              onBuy={() => confirmPurchase(item)}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('shop.sections.owned')}</Text>
        {snapshot.ownedItems.length === 0 ? (
          <EmptyCard label={t('shop.emptyOwned')} />
        ) : (
          <View style={styles.ownedList}>
            {snapshot.ownedItems.map((item) => (
              <OwnedItemRow
                item={item}
                key={item.key}
                numberFormatter={numberFormatter}
                {...(item.key === COMIC_QUOTA_ITEM_KEY
                  ? {
                      onUse: confirmQuotaUse,
                      using: usingQuota,
                    }
                  : {})}
              />
            ))}
          </View>
        )}
        {snapshot.ownedItems.some((item) => item.key === SIGN_MAKEUP_ITEM_KEY) ? (
          <View style={styles.makeupPanel}>
            <Text style={styles.makeupTitle}>{t('shop.makeupTitle')}</Text>
            <Text style={styles.makeupDescription}>{t('shop.makeupDescription')}</Text>
            {calendarStatus === 'loading' ? (
              <View style={styles.calendarState}>
                <ActivityIndicator color={resolveAccentHex(colors.accent)} />
                <Text style={styles.calendarStateText}>{t('shop.calendar.loading')}</Text>
              </View>
            ) : calendarStatus === 'error' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setCalendarReload((current) => current + 1)}
                style={({ pressed }) => [styles.calendarRetry, pressed && styles.pressed]}
              >
                <IconRefresh color={resolveAccentHex(colors.accent)} size={18} strokeWidth={2} />
                <Text style={styles.retryLabel}>{t('shop.calendar.retry')}</Text>
              </Pressable>
            ) : calendar ? (
              <>
                <View style={styles.calendarHeader}>
                  <Pressable
                    accessibilityLabel={t('shop.calendar.previousMonth')}
                    accessibilityRole="button"
                    disabled={!canGoPreviousMonth}
                    onPress={() => shiftCalendarMonth(-1)}
                    style={({ pressed }) => [styles.calendarNavButton, pressed && styles.pressed]}
                  >
                    <IconChevronLeft
                      color={canGoPreviousMonth ? resolveAccentHex(colors.accent) : '#8E8E93'}
                      size={20}
                      strokeWidth={2}
                    />
                  </Pressable>
                  <Text style={styles.calendarMonthTitle}>
                    {t('shop.calendar.month', { month: calendarMonthNumber, year: calendarYear })}
                  </Text>
                  <Pressable
                    accessibilityLabel={t('shop.calendar.nextMonth')}
                    accessibilityRole="button"
                    disabled={!canGoNextMonth}
                    onPress={() => shiftCalendarMonth(1)}
                    style={({ pressed }) => [styles.calendarNavButton, pressed && styles.pressed]}
                  >
                    <IconChevronRight
                      color={canGoNextMonth ? resolveAccentHex(colors.accent) : '#8E8E93'}
                      size={20}
                      strokeWidth={2}
                    />
                  </Pressable>
                </View>
                <View style={styles.calendarGrid}>
                  {calendarWeekdayLabels.map((label) => (
                    <View key={label} style={styles.calendarCell}>
                      <Text style={styles.calendarWeekday}>{label}</Text>
                    </View>
                  ))}
                  {calendarCells.map((day, index) => {
                    if (day === null) return <View key={`blank-${index}`} style={styles.calendarCell} />;
                    const date = formatCalendarDate(calendarYear, calendarMonthNumber, day);
                    const signed = signedDates.has(date);
                    const available = isCalendarDateAvailable(date, calendar);
                    const selected = date === selectedMakeupDate && selectedDateIsAvailable;
                    return (
                      <View key={date} style={styles.calendarCell}>
                        <Pressable
                          accessibilityLabel={date}
                          accessibilityRole="button"
                          disabled={!available}
                          onPress={() => selectCalendarDay(day)}
                          style={[
                            styles.calendarDay,
                            signed && styles.calendarDaySigned,
                            !available && styles.calendarDayDisabled,
                            selected && styles.calendarDaySelected,
                          ]}
                        >
                          <Text style={[styles.calendarDayLabel, selected && styles.calendarDaySelectedLabel]}>
                            {day}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
            <View style={styles.makeupActionRow}>
              <Text style={styles.selectedDate}>
                {selectedDateIsAvailable
                  ? t('shop.calendar.selected', { date: selectedMakeupDate })
                  : t('shop.calendar.selectDate')}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={usingMakeup || !selectedDateIsAvailable}
                onPress={confirmMakeup}
                style={({ pressed }) => [
                  styles.buyButton,
                  styles.makeupButton,
                  (usingMakeup || !selectedDateIsAvailable) && styles.buyButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {usingMakeup ? <ActivityIndicator color={resolveOnAccentHex(colors.accent)} size="small" /> : null}
                <Text style={styles.buyLabel}>{usingMakeup ? t('shop.usingMakeup') : t('shop.useMakeup')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function ShopItemCard({
  buying,
  item,
  numberFormatter,
  onBuy,
}: {
  buying: boolean;
  item: ShopItem;
  numberFormatter: Intl.NumberFormat;
  onBuy: () => void;
}) {
  const styles = useShopSettingsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('settings');
  const availability = resolveShopPurchaseAvailability(item);
  const disabled = availability.state === 'unavailable'
    || availability.state === 'limitReached'
    || buying;

  return (
    <View style={styles.itemCard}>
      <ShopItemImage name={item.name} value={item.image} />
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
        <View style={styles.itemMetadata}>
          <Text style={styles.itemPrice}>
            {t('shop.price', { price: numberFormatter.format(item.price) })}
          </Text>
          <Text style={styles.itemMeta}>
            {availability.state === 'unlimited'
              ? t('shop.unlimited')
              : availability.state === 'unavailable'
                ? t('shop.unavailable')
                : t('shop.remaining', {
                    limit: numberFormatter.format(item.monthlyLimit ?? 0),
                    remaining: numberFormatter.format(availability.remaining ?? 0),
                  })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onBuy}
          style={({ pressed }) => [
            styles.buyButton,
            disabled && styles.buyButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          {buying ? <ActivityIndicator color={resolveOnAccentHex(colors.accent)} size="small" /> : null}
          <Text style={styles.buyLabel}>
            {buying
              ? t('shop.buying')
              : availability.state === 'unavailable'
                ? t('shop.unavailable')
                : availability.state === 'limitReached'
                  ? t('shop.limitReached')
                  : t('shop.buy')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function OwnedItemRow({
  item,
  numberFormatter,
  onUse,
  using = false,
}: {
  item: OwnedShopItem;
  numberFormatter: Intl.NumberFormat;
  onUse?: () => void;
  using?: boolean;
}) {
  const styles = useShopSettingsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('settings');
  return (
    <View style={styles.ownedRow}>
      <ShopItemImage compact name={item.name} value={item.image} />
      <View style={styles.ownedCopy}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.description ? (
          <Text numberOfLines={2} style={styles.itemDescription}>{item.description}</Text>
        ) : null}
      </View>
      <View style={styles.ownedActions}>
        <Text style={styles.ownedQuantity}>
          {t('shop.owned', { quantity: numberFormatter.format(item.quantity) })}
        </Text>
        {onUse ? (
          <Pressable
            accessibilityLabel={t('shop.useQuota')}
            accessibilityRole="button"
            disabled={using}
            onPress={onUse}
            style={({ pressed }) => [
              styles.useItemButton,
              using && styles.buyButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            {using ? <ActivityIndicator color={resolveAccentHex(colors.accent)} size="small" /> : null}
            <Text style={styles.useItemLabel}>
              {using ? t('shop.usingQuota') : t('shop.useQuota')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ShopItemImage({
  compact = false,
  name,
  value,
}: {
  compact?: boolean;
  name: string;
  value: string;
}) {
  const styles = useShopSettingsStyles();
  const { colors } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const source = resolveShopImageUrl(value);
  const imageStyle = compact ? styles.ownedImage : styles.itemImage;

  if (!source || failed) {
    return (
      <View accessibilityLabel={name} style={[imageStyle, styles.imageFallback]}>
        <IconPhotoOff color="#8E8E93" size={compact ? 22 : 28} strokeWidth={1.8} />
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={name}
      contentFit="cover"
      onError={() => setFailed(true)}
      source={{ uri: source }}
      style={imageStyle}
      transition={120}
    />
  );
}

function EmptyCard({ label }: { label: string }) {
  const styles = useShopSettingsStyles();
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

const useShopSettingsStyles = createThemedStyles((colors) => ({
  balanceCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  balanceCopy: { flex: 1, gap: 3 },
  balanceIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryContainer,
    borderCurve: 'continuous',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  balanceValue: { color: colors.label, fontSize: 24, fontWeight: '700', lineHeight: 30 },
  buyButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderCurve: 'continuous',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buyButtonDisabled: { opacity: 0.45 },
  buyLabel: { color: resolveOnAccentHex(colors.accent), fontSize: 14, fontWeight: '700' },
  calendarCell: { alignItems: 'center', height: 40, justifyContent: 'center', width: '14.2857%' },
  calendarDay: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  calendarDayDisabled: { opacity: 0.32 },
  calendarDayLabel: { color: colors.label, fontSize: 14, lineHeight: 18 },
  calendarDaySelected: { backgroundColor: colors.accent },
  calendarDaySelectedLabel: { color: resolveOnAccentHex(colors.accent), fontWeight: '700' },
  calendarDaySigned: { backgroundColor: colors.surfaceContainerHighest },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  calendarMonthTitle: { color: colors.label, flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  calendarNavButton: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  calendarRetry: { alignItems: 'center', flexDirection: 'row', gap: 7, paddingVertical: 8 },
  calendarState: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  calendarStateText: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 18 },
  calendarWeekday: { color: colors.secondaryLabel, fontSize: 12, fontWeight: '600' },
  content: { gap: 26, paddingHorizontal: 20, paddingTop: 20 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyText: { color: colors.secondaryLabel, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  errorText: { color: colors.error, flex: 1, fontSize: 13, lineHeight: 18 },
  imageFallback: { alignItems: 'center', backgroundColor: colors.surfaceContainerHighest, justifyContent: 'center' },
  inlineError: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  itemBody: { flex: 1, gap: 8 },
  itemCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 15,
    padding: 16,
  },
  itemDescription: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 18 },
  itemImage: { borderCurve: 'continuous', borderRadius: 16, height: 88, width: 88 },
  itemMeta: { color: colors.secondaryLabel, fontSize: 12, lineHeight: 17 },
  itemMetadata: { gap: 2 },
  itemName: { color: colors.label, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  itemPrice: { color: colors.label, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  makeupActionRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  makeupButton: { flexShrink: 0 },
  makeupDatePicker: { flex: 1, minWidth: 0 },
  makeupDescription: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 19 },
  makeupPanel: { backgroundColor: colors.card, borderCurve: 'continuous', borderRadius: 22, gap: 10, padding: 16 },
  makeupTitle: { color: colors.label, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  ownedActions: { alignItems: 'flex-end', flexShrink: 0, gap: 7 },
  ownedCopy: { flex: 1, gap: 2 },
  ownedImage: { borderCurve: 'continuous', borderRadius: 12, height: 48, width: 48 },
  ownedList: { backgroundColor: colors.card, borderCurve: 'continuous', borderRadius: 22, overflow: 'hidden' },
  ownedQuantity: { color: colors.secondaryLabel, fontSize: 13, fontWeight: '600' },
  ownedRow: {
    alignItems: 'center',
    borderBottomColor: colors.separator,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.68 },
  retryButton: { alignItems: 'center', flexDirection: 'row', gap: 7, padding: 8 },
  retryLabel: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  root: { backgroundColor: colors.background, flex: 1 },
  section: { gap: 12 },
  sectionEyebrow: { color: colors.secondaryLabel, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  sectionTitle: { color: colors.label, fontSize: 19, fontWeight: '700', lineHeight: 24 },
  selectedDate: { color: colors.secondaryLabel, flex: 1, fontSize: 13, lineHeight: 18 },
  stateRoot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: { color: colors.label, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  useItemButton: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  useItemLabel: { color: colors.accent, fontSize: 13, fontWeight: '700' },
}));

function createCalendarCells(year: number, month: number): Array<number | null> {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
}

function formatCalendarDate(year: number, month: number, day: number): string {
  return [
    year,
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function parseUtcDate(value: string): Date {
  const parts = value.split('-');
  const year = Number(parts[0] ?? 0);
  const month = Number(parts[1] ?? 0);
  const day = Number(parts[2] ?? 0);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 12));
}

function isMakeupDateInWindow(value: string): boolean {
  const today = formatUtcDate(utcDateAtNoon(0));
  const floor = formatUtcDate(utcDateAtNoon(-30));
  return value >= floor && value < today;
}

function isCalendarDateAvailable(value: string, calendar: SignInCalendar): boolean {
  return isMakeupDateInWindow(value)
    && !calendar.days.some((day) => day.date.slice(0, 10) === value);
}

function findFirstAvailableDate(calendar: SignInCalendar): string | null {
  const cells = createCalendarCells(calendar.year, calendar.month);
  for (const day of cells) {
    if (day === null) continue;
    const date = formatCalendarDate(calendar.year, calendar.month, day);
    if (isCalendarDateAvailable(date, calendar)) return date;
  }
  return null;
}