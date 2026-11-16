import { AppText as Text } from '@makanza/mobile-ui';
import { StyleSheet, View } from 'react-native';
import type { AppColors } from '../theme/colors';

type Props = { point: { latitude: number; longitude: number } | null; colors: AppColors; onPick: (point: { latitude: number; longitude: number }) => void };

export default function AddressMapPicker({ colors }: Props) {
  return <View style={[styles.frame, { backgroundColor: colors.cream, borderColor: colors.line }]}>
    <Text style={[styles.copy, { color: colors.muted }]}>Map pin selection is available in the iOS and Android apps. Search for a Nigerian location above.</Text>
  </View>;
}

const styles = StyleSheet.create({
  frame: { minHeight: 100, alignItems: 'center', justifyContent: 'center', padding: 18, borderWidth: 1, borderRadius: 14, marginTop: 10 },
  copy: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
