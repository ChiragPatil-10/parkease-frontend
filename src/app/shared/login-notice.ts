/** One-time messages the login page can show after the user arrives from another auth page. */
export type LoginNoticeKey = 'password-reset' | 'password-changed';

/** Key of the router navigation state that carries the notice. Holds a key, never free text. */
export const LOGIN_NOTICE_STATE = 'loginNotice';

export const LOGIN_NOTICES: Record<LoginNoticeKey, string> = {
  'password-reset': 'Password reset. Sign in with your new password.',
  'password-changed': 'Password changed. Sign in with your new password.',
};

export function isLoginNoticeKey(value: unknown): value is LoginNoticeKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LOGIN_NOTICES, value);
}
