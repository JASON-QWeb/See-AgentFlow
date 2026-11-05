import { useEffect } from 'react';
import { LockKey } from '@phosphor-icons/react';
import { useTranslation } from './i18n/useTranslation.js';

export function LockSettings({ open, lock }) {
  const t = useTranslation();
  useEffect(() => { if (open) lock.refresh(); }, [open, lock.refresh]);
  if (!lock.available) return null;
  return <section className="lock-settings">
    <h3>{t('FULLSCREEN LOCK')}</h3>
    <div className="lock-password-setting"><div><strong>{t('Fullscreen password')}</strong>
      <p className="theme-hint">{t(lock.configured ? 'Password configured' : 'Password not set')}</p></div>
      <button type="button" className="console-button" onClick={lock.configure} disabled={lock.busy || !lock.storageAvailable}>
        <LockKey size={15} />{t(lock.configured ? 'Change password…' : 'Set password…')}
      </button>
    </div>
    <label className="setting-row"><div>{t('Lock again after screen saver')}
      <p>{t('After macOS returns to desktop, require the app password on every display.')}</p></div>
      <input type="checkbox" checked={lock.afterSaver} disabled={lock.busy} onChange={event => lock.setAfterSaver(event.target.checked)} />
    </label>
    <p className="theme-hint">{t('Password entry stays in the native App.')}</p>
    <p className="theme-hint">{t('Recovery: click the password field border 10 times in succession.')}</p>
    <p className="theme-hint" role="status">{t(lock.error || (!lock.storageAvailable ? 'Password storage is unavailable.' : 'App-level privacy cover; macOS authentication is unchanged.'))}</p>
  </section>;
}
