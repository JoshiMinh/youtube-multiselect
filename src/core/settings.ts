import { storage } from 'wxt/utils/storage';

/** Whether the extension injects controls on YouTube. Stored locally only. */
export const enabledSetting = storage.defineItem<boolean>('local:enabled', { fallback: true });
