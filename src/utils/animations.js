import { Animated, Easing } from 'react-native';
export const createFadeInAnimation = (animatedValue, duration = 300, delay = 0) => {
  return Animated.timing(animatedValue, {
    toValue: 1,
    duration,
    delay,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  });
};
export const createFadeOutAnimation = (animatedValue, duration = 300) => {
  return Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    easing: Easing.in(Easing.quad),
    useNativeDriver: true,
  });
};
export const createSlideInFromBottom = (animatedValue, duration = 400) => {
  return Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    easing: Easing.out(Easing.back(1.2)),
    useNativeDriver: true,
  });
};
export const createSlideInFromRight = (animatedValue, duration = 300) => {
  return Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  });
};

export const createSlideInFromLeft = (animatedValue, duration = 300) => {
  return Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  });
};
export const createScaleAnimation = (animatedValue, toValue = 1, duration = 200) => {
  return Animated.timing(animatedValue, {
    toValue,
    duration,
    easing: Easing.out(Easing.back(1.1)),
    useNativeDriver: true,
  });
};
export const createSpringAnimation = (animatedValue, toValue = 1) => {
  return Animated.spring(animatedValue, {
    toValue,
    friction: 8,
    tension: 40,
    useNativeDriver: true,
  });
};
export const createPulseAnimation = (animatedValue) => {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1.1,
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ])
  );
};
export const createStaggeredAnimations = (animatedValues, duration = 300, stagger = 100) => {
  return Animated.stagger(
    stagger,
    animatedValues.map(value =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    )
  );
};
export const createBounceAnimation = (animatedValue) => {
  return Animated.sequence([
    Animated.timing(animatedValue, {
      toValue: 1.2,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
    Animated.timing(animatedValue, {
      toValue: 0.9,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
  ]);
};
