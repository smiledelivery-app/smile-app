import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

export default function FontSplashScreen() {
  const pulse = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.92, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.45, duration: 900, useNativeDriver: true }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, pulse]);

  return (
    <View style={s.screen} accessibilityLabel="Loading Smile">
      <View style={s.topLine} />
      <Animated.View style={[s.brandBlock, { transform: [{ scale: pulse }] }]}>
        <Image accessibilityLabel="Smile logo" source={require('../../assets/splash-icon.png')} resizeMode="contain" style={s.brandMark} />
        <Text style={s.brand}>smile</Text>
      </Animated.View>
      <Animated.View style={[s.loadingCopy, { opacity }]}>
        <Text style={s.kicker}>A LITTLE JOY, DELIVERED</Text>
        <Text style={s.message}>Getting things ready for you.</Text>
        <View style={s.progressTrack}><View style={s.progressFill} /></View>
      </Animated.View>
      <Text style={s.footer}>LOCAL FOOD · EASY DELIVERY</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1d6147', alignItems: 'center', justifyContent: 'center', padding: 28 },
  topLine: { position: 'absolute', top: 0, left: 28, right: 28, height: 4, backgroundColor: '#7cc7a0' },
  brandBlock: { alignItems: 'center', justifyContent: 'center' },
  brandMark: { width: 76, height: 76, marginBottom: 14 },
  brand: { color: '#ffffff', fontSize: 38, lineHeight: 46, letterSpacing: -1.5, fontWeight: '800', fontFamily: 'sans-serif' },
  loadingCopy: { position: 'absolute', left: 28, right: 28, bottom: 92, alignItems: 'center' },
  kicker: { color: '#b9d9c8', fontSize: 11, lineHeight: 16, letterSpacing: 1.6, fontWeight: '700', fontFamily: 'sans-serif' },
  message: { color: '#ffffff', fontSize: 16, lineHeight: 23, marginTop: 9, fontWeight: '500', fontFamily: 'sans-serif' },
  progressTrack: { width: 116, height: 4, borderRadius: 4, overflow: 'hidden', backgroundColor: '#397858', marginTop: 18 },
  progressFill: { width: 54, height: 4, borderRadius: 4, backgroundColor: '#f6f5f2' },
  footer: { position: 'absolute', bottom: 28, color: '#b9d9c8', fontSize: 10, lineHeight: 14, letterSpacing: 1.2, fontWeight: '700', fontFamily: 'sans-serif' },
});
