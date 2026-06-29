import { ReactNode } from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows } from '../theme';

type HeroHeaderProps = {
  eyebrow: string;
  title: string;
  image?: ImageSourcePropType;
  right?: ReactNode;
};

/**
 * Blue "hero" card used at the top of the signature screens (Today, Workout).
 * Sits inside the normal padded layout so safe-area and scrolling stay intact,
 * while still delivering the bold gamified banner from the redesign.
 */
export function HeroHeader({ eyebrow, title, image, right }: HeroHeaderProps) {
  return (
    <View style={styles.card}>
      {image ? <Image source={image} style={styles.image} /> : null}
      <View style={styles.text}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.primary,
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: 16,
    padding: 20,
  },
  eyebrow: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  image: {
    borderRadius: 20,
    height: 72,
    width: 72,
  },
  right: {
    marginLeft: 'auto',
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '900',
  },
});
