import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import type { SessionScope } from '@/lib/auth-session';
import { studyStyles as styles } from '@/study/study-sheet';
import { theme } from '@/theme';
import { defaultGeofenceRadius, validateGeofence, type Geofence, type Poi } from './domain';
import { searchPois } from './poi-data';

export function GeofencePicker({ initial, client, scope, onCancel, onSelect }:
  { initial: Geofence | null; client: SupabaseClient; scope: SessionScope;
    onCancel: () => void; onSelect: (value: Geofence) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Poi[] | null>(null);
  const [selected, setSelected] = useState<Geofence | null>(initial);
  const [radius, setRadius] = useState(String(initial?.radius ?? defaultGeofenceRadius));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0), active = useRef(true), controller = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => {
    active.current = false; controller.current?.abort();
  }; }, []);
  const changeQuery = (value: string) => {
    request.current++; controller.current?.abort(); setQuery(value); setResults(null); setError(null); setBusy(false);
  };
  const search = async () => {
    if (busy || !scope.isCurrent()) return;
    const sequence = ++request.current;
    controller.current?.abort(); controller.current = new AbortController();
    setBusy(true); setError(null); setResults(null);
    const current = () => active.current && scope.isCurrent() && request.current === sequence;
    try {
      const pois = await searchPois(client, query, controller.current.signal);
      if (current()) setResults(pois);
    } catch (failure) {
      if (current()) setError(failure instanceof Error ? failure.message : '地点搜索未完成，请重试。');
    } finally { if (current()) setBusy(false); }
  };
  const useSelection = () => {
    if (!scope.isCurrent()) return;
    if (!selected) { setError('请先从高德搜索结果中选择地点。'); return; }
    const value = { ...selected, radius: /^\d+$/.test(radius.trim()) ? Number(radius) : NaN };
    const checked = validateGeofence(value);
    if (!checked.ok) { setError(checked.error); return; }
    onSelect(value);
  };
  return <>
    <Text accessibilityRole="header" style={styles.title}>选择学习地点</Text>
    <Text style={styles.helper}>搜索高德地点并选择；仅保存地点中心与半径，不记录你的实际位置。</Text>
    <TextInput accessibilityLabel="搜索地点名称" value={query} onChangeText={changeQuery} style={styles.input}
      placeholder="例如：国家图书馆" maxLength={50} returnKeyType="search" onSubmitEditing={() => { void search(); }} />
    <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy, busy }}
      style={[styles.button, busy && styles.disabled]} onPress={() => { void search(); }}>
      <Text style={styles.primaryText}>{busy ? '搜索中…' : '搜索地点'}</Text>
    </Pressable>
    {busy && <ActivityIndicator color={theme.colors.primary} accessibilityLabel="正在搜索高德地点" />}
    {results?.length === 0 && <Text style={styles.helper}>没有找到地点，试试完整名称或加上城市。</Text>}
    {results?.map((poi) => <Pressable key={poi.id} accessibilityRole="button" accessibilityLabel={`选择地点 ${poi.name} ${poi.address}`}
      style={styles.card} onPress={() => { setSelected({ name: poi.name, latitude: poi.latitude,
        longitude: poi.longitude, coordinateSystem: 'gcj02', radius: defaultGeofenceRadius }); setResults(null); setError(null); }}>
      <Text style={styles.label}>{poi.name}</Text><Text style={styles.helper}>{poi.address || '高德地点'}</Text>
    </Pressable>)}
    <View style={styles.card}>
      <Text style={styles.label}>{selected ? `已选：${selected.name}` : '尚未选择地点'}</Text>
      <Text style={styles.label}>围栏半径（米）</Text>
      <TextInput accessibilityLabel="围栏半径" value={radius} onChangeText={(value) => { setRadius(value); setError(null); }}
        style={styles.input} keyboardType="number-pad" maxLength={4} placeholder="50–1000，默认200" />
      <Text style={styles.helper}>50–1000米；保存计划后，在范围内才能实时打卡。</Text>
    </View>
    {error && <Text accessibilityRole="alert" style={styles.message}>{error}</Text>}
    <Pressable accessibilityRole="button" style={styles.button} onPress={useSelection}>
      <Text style={styles.primaryText}>使用此地点与半径</Text>
    </Pressable>
    <Pressable accessibilityRole="button" style={styles.textButton} onPress={onCancel}><Text style={styles.link}>取消选点</Text></Pressable>
  </>;
}
