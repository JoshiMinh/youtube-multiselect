import type { PageInfo, PlatformAdapter } from '../adapters/types';
import type { ContentStatus } from '../core/messages';
import { PageSession, type SessionDeps } from './session';

export interface AppDeps extends Omit<SessionDeps, 'page'> {
  adapter: PlatformAdapter;
  getUrl(): URL;
  isEnabled(): Promise<boolean>;
  watchEnabled(listener: (enabled: boolean) => void): () => void;
  /** Extra URL-change source (e.g. WXT's `wxt:locationchange`). */
  watchLocation?(listener: () => void, signal: AbortSignal): void;
}

/**
 * Decides, after every navigation or setting change, whether a PageSession
 * should exist and for which playlist. At most one session is alive.
 */
export class AppController {
  private readonly deps: AppDeps;
  private readonly abort = new AbortController();
  private session: PageSession | null = null;
  private enabled = true;
  private page: PageInfo = { kind: 'unsupported', reason: 'Not started.' };

  constructor(deps: AppDeps) {
    this.deps = deps;
  }

  get currentSession(): PageSession | null {
    return this.session;
  }

  async start(): Promise<void> {
    const signal = this.abort.signal;
    this.enabled = await this.deps.isEnabled();
    if (signal.aborted) return;
    const unwatch = this.deps.watchEnabled((enabled) => {
      this.enabled = enabled;
      this.refresh();
    });
    signal.addEventListener('abort', unwatch, { once: true });
    this.deps.adapter.onNavigate(this.deps.doc, () => this.refresh(), signal);
    this.deps.watchLocation?.(() => this.refresh(), signal);
    this.refresh();
  }

  stop(): void {
    this.abort.abort();
    this.endSession();
  }

  status(): ContentStatus {
    return { enabled: this.enabled, page: this.page, session: this.session?.getSnapshot() ?? null };
  }

  private refresh(): void {
    if (this.abort.signal.aborted) return;
    this.page = this.deps.adapter.detectPage(this.deps.getUrl(), this.deps.doc);
    if (!this.enabled || this.page.kind !== 'playlist') {
      this.endSession();
      return;
    }
    if (this.session && this.session.page.playlistId === this.page.playlistId) {
      // Same playlist re-rendered (e.g. repeated navigate events): keep selection.
      this.session.scan();
      return;
    }
    this.endSession();
    const session = new PageSession({ ...this.deps, page: this.page });
    this.session = session;
    void session.start();
  }

  private endSession(): void {
    this.session?.dispose();
    this.session = null;
  }
}
