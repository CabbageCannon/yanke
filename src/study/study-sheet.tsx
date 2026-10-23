import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

export function StudySheet({ title, busy, onClose, children }:
  { title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={studyStyles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={studyStyles.panel}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={studyStyles.content}>
            <Text accessibilityRole="header" style={studyStyles.title}>{title}</Text>
            <Pressable accessibilityRole="button" style={studyStyles.textButton} onPress={onClose}>
              <Text style={studyStyles.link}>{busy ? '关闭（结果可稍后刷新）' : '关闭'}</Text>
            </Pressable>
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const studyStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.2)' },
  panel: { maxHeight: '94%', width: '100%', maxWidth: 560, alignSelf: 'center',
    backgroundColor: theme.colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  content: { padding: theme.spacing.page, gap: 12 },
  title: { fontSize: theme.fontSize.title, fontWeight: '600', color: theme.colors.text },
  label: { fontSize: theme.fontSize.body, color: theme.colors.text, lineHeight: 22 },
  helper: { fontSize: theme.fontSize.caption, color: theme.colors.secondaryText, lineHeight: 20 },
  message: { fontSize: theme.fontSize.body, color: theme.colors.text, lineHeight: 22 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12,
    backgroundColor: theme.colors.card, paddingHorizontal: 12, color: theme.colors.text, fontSize: theme.fontSize.body },
  summary: { minHeight: 96, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  textButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', padding: 8 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12,
    backgroundColor: theme.colors.primary, borderRadius: 12 },
  link: { fontSize: theme.fontSize.body, color: theme.colors.primary },
  primaryText: { fontSize: theme.fontSize.body, fontWeight: '600', color: theme.colors.card, textAlign: 'center' },
  disabled: { opacity: 0.6 },
  card: { backgroundColor: theme.colors.card, padding: 12, gap: 8, borderRadius: 12 },
});
