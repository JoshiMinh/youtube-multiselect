import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { injectScript } from 'wxt/utils/inject-script';
import { youtubeAdapter } from '@/src/adapters/youtube/adapter';
import { AppController } from '@/src/controller/app';
import { isContentMessage } from '@/src/core/messages';
import { enabledSetting } from '@/src/core/settings';
import { Toolbar } from '@/src/ui/Toolbar';
import '@/src/ui/toolbar.css';

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    try {
      await injectScript('/youtube-bridge.js', { keepInDom: true });
    } catch {
      // Without the bridge, rows fall back to position-based identity.
    }

    const app = new AppController({
      adapter: youtubeAdapter,
      doc: document,
      getUrl: () => new URL(location.href),
      isEnabled: () => enabledSetting.getValue(),
      watchEnabled: (listener) => enabledSetting.watch((value) => listener(value)),
      watchLocation: (listener, signal) => {
        ctx.addEventListener(window, 'wxt:locationchange', listener, { signal });
      },
      mountToolbar: async (store) => {
        const ui = await createShadowRootUi(ctx, {
          name: 'ytms-toolbar',
          position: 'inline',
          anchor: 'body',
          append: 'last',
          // Keep YouTube's global keyboard shortcuts from firing while typing/focusing here.
          isolateEvents: ['keydown', 'keyup', 'keypress'],
          onMount: (container, _shadow, host) => {
            host.setAttribute('data-ytms-host', 'toolbar');
            const root = createRoot(container);
            root.render(<Toolbar store={store} />);
            return root;
          },
          onRemove: (root) => root?.unmount(),
        });
        ui.mount();
        return { remove: () => ui.remove() };
      },
    });

    const onMessage = (message: unknown) => {
      if (isContentMessage(message)) return Promise.resolve(app.status());
      return undefined;
    };
    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(onMessage);
      app.stop();
    });

    await app.start();
  },
});
