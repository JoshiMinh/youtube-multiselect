import { element as el, svg, dragHandle } from './dom.js';

const pathIcon = (d) => svg('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true' }, svg('path', { d, fill: 'currentColor' }));

export function createFilter({ messages, state, checkboxes, data, onChange, onClose, onHelp, onError }) {
  const id = 'msfy-select-filter';
  const statusId = `${id}-status`;
  const input = el('input', { id: `${id}-query`, type: 'text', 'aria-describedby': statusId, autocomplete: 'off', spellcheck: 'false' });
  const output = el('output', {}, el('span'), ' %');
  const option = el('input', { type: 'checkbox', id: `${id}-case-sensitive` });
  const optionLabel = el('label', { for: option.id }, messages.caseSensitive);
  const status = el('p', { id: statusId, class: 'msfy-filter-status', role: 'status', 'aria-live': 'polite' }, messages.filterHelp);
  const apply = el('button', { id: 'done', type: 'button', class: 'msfy-filter-apply' },
    pathIcon('m9 16.2-4.2-4.2L3.4 13.4 9 19l12-12-1.4-1.4z'), el('span', {}, messages.filterApply));
  const fieldLabel = el('label', { class: 'msfy-filter-label', for: input.id }, messages.filterPattern);
  const close = el('button', { id: `${id}-close`, type: 'button', class: 'msfy-filter-icon', 'aria-label': messages.close }, pathIcon('m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z'));
  const help = el('button', { id: `${id}-help`, type: 'button', class: 'msfy-filter-icon', 'aria-label': messages.filterHelpTooltip, title: messages.filterHelpTooltip }, pathIcon('M11 17h2v2h-2zm1-15a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2c-2.2 0-4 1.8-4 4h2a2 2 0 1 1 3.4 1.4C12 12.6 11 13.2 11 15h2c0-1 .5-1.4 1.8-2.6A4 4 0 0 0 12 6z'));
  const choice = el('div', { id: 'choice', role: 'radiogroup', 'aria-label': messages.filterSource });
  const root = el('div', { id, class: 'msfy-filter', role: 'region', 'aria-labelledby': `${id}-title`, 'data-state': 'default' }, dragHandle(),
    el('div', { id: 'content' },
      el('header', {}, pathIcon('M3 5h18v2H3zm4 6h10v2H7zm3 6h4v2h-4z'), el('span', { id: `${id}-title` }, messages.selectWithFilter), help, close),
      choice, fieldLabel, el('section', {}, input, output), status,
      el('footer', {}, el('div', { class: 'msfy-filter-option' }, option, optionLabel), apply)));
  let source = 'title';
  let current = state.title;
  let frame = 0;
  let busy = false;

  function cancelPending() {
    cancelAnimationFrame(frame);
    frame = 0;
    busy = false;
    root.removeAttribute('aria-busy');
  }

  function feedback(kind, text) {
    root.dataset.state = kind;
    status.textContent = text;
    input.setAttribute('aria-invalid', String(kind === 'error'));
  }
  function refresh() {
    input.type = source === 'watched' ? 'range' : 'text';
    if (source === 'watched') input.min = '1', input.max = '100';
    else input.removeAttribute('min'), input.removeAttribute('max');
    input.value = current.value;
    output.hidden = source !== 'watched';
    output.firstElementChild.textContent = current.value;
    option.checked = current.option;
    optionLabel.textContent = source === 'watched' ? messages.reverseFilter : messages.caseSensitive;
    fieldLabel.textContent = source === 'watched' ? `${messages.watched} ${option.checked ? '<' : '≥'}` : messages.filterPattern;
    apply.disabled = !input.value || busy;
    feedback('default', messages.filterHelp);
  }
  for (const [value, key, text] of [['title', 'title', messages.title], ['shortBylineText', 'channel', messages.channelName], ['watched', 'watched', messages.watched]]) {
    const radio = el('input', { type: 'radio', name: 'source', value, id: `source-${key}`, checked: key === 'title' });
    radio.addEventListener('change', () => {
      cancelPending();
      source = value;
      current = state[key];
      refresh();
      input.focus();
    });
    choice.append(el('label', { title: text }, radio, el('span', {}, text)));
  }
  function validate() {
    if (source === 'watched' || !input.value) return true;
    try { new RegExp(input.value, option.checked ? '' : 'i'); return true; }
    catch { feedback('error', messages.invalidFilter); return false; }
  }
  input.addEventListener('input', () => {
    cancelPending();
    current.value = input.value;
    output.firstElementChild.textContent = input.value;
    apply.disabled = !input.value || busy;
    const invalid = root.dataset.state === 'error';
    feedback('default', messages.filterHelp);
    if (invalid) validate();
  });
  input.addEventListener('blur', validate);
  option.addEventListener('change', () => {
    cancelPending();
    current.option = option.checked;
    apply.disabled = !input.value;
    const invalid = root.dataset.state === 'error';
    if (source === 'watched') fieldLabel.textContent = `${messages.watched} ${option.checked ? '<' : '≥'}`;
    feedback('default', messages.filterHelp);
    if (invalid) validate();
  });
  function select() {
    if (busy || !input.value || !validate()) return;
    busy = true;
    apply.disabled = true;
    root.setAttribute('aria-busy', 'true');
    feedback('loading', messages.filterLoading);
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!root.isConnected) return;
      let count = 0;
      try {
        const matcher = source === 'watched' ? Number(input.value) : new RegExp(input.value, option.checked ? '' : 'i');
        for (const checkbox of checkboxes()) {
          const item = data(checkbox) || {};
          let matches;
          if (source === 'watched') {
            const progress = item.thumbnailOverlays?.find((entry) => entry.thumbnailOverlayResumePlaybackRenderer)?.thumbnailOverlayResumePlaybackRenderer?.percentDurationWatched ?? 0;
            matches = option.checked ? progress < matcher : progress >= matcher;
          } else {
            const text = item[source]?.runs?.map((run) => run.text).join('') || item[source]?.simpleText || (source === 'title' ? item.headline?.simpleText : '') || '';
            matches = matcher.test(text);
          }
          if (matches) checkbox.checked = true, count++;
        }
        feedback('success', messages.filterResult.replace('{count}', String(count)));
        onChange();
      } catch (error) {
        feedback('error', messages.invalidFilter);
        onError?.(error);
      } finally {
        busy = false;
        apply.disabled = !input.value;
        root.removeAttribute('aria-busy');
      }
    });
  }
  apply.addEventListener('click', select);
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') event.preventDefault(), select(); });
  root.addEventListener('keydown', (event) => { if (event.key === 'Escape') event.preventDefault(), event.stopPropagation(), onClose(); });
  close.addEventListener('click', onClose);
  help.addEventListener('click', onHelp);
  refresh();
  return { root, input, destroy: () => { cancelAnimationFrame(frame); root.remove(); } };
}
