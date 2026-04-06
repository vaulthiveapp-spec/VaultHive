import { CommonActions } from '@react-navigation/native';

/**
 * resetToLogin — navigate to the Login screen inside the GuestStack,
 * clearing the entire navigation history.
 *
 * The unauthenticated navigator is named GuestStack internally but
 * its root Stack contains a "Login" screen directly accessible by name.
 */
export const resetToLogin = (navigation, email) => {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [
        {
          name: 'Login',
          params: email ? { prefill: { email } } : undefined,
        },
      ],
    })
  );
};
