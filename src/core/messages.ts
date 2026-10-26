import type { PageInfo } from '../adapters/types';
import type { SessionSnapshot } from '../controller/session';

/** Popup -> content script. */
export interface GetStatusMessage {
  type: 'ytms:get-status';
}

export type ContentMessage = GetStatusMessage;

export interface ContentStatus {
  enabled: boolean;
  page: PageInfo;
  session: SessionSnapshot | null;
}

export function isContentMessage(value: unknown): value is ContentMessage {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'ytms:get-status';
}
