import { element } from './dom.js';

export function createPlaylistIndexes({ prefix, runtimeId, canShow, isModern, label }) {
  const entries = new Map();
  let sequence = 0;
  let selecting = false;

  function remove(row, entry) {
    entry.badge.remove();
    entry.description.remove();
    const descriptions = (entry.checkbox.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== entry.description.id);
    if (descriptions.length) entry.checkbox.setAttribute('aria-describedby', descriptions.join(' '));
    else entry.checkbox.removeAttribute('aria-describedby');
    row.removeAttribute('data-msfy-indexed');
    row.removeAttribute('data-msfy-selecting');
    if (entry.position != null && row.style.position === 'relative') {
      if (entry.position) row.style.setProperty('position', entry.position, entry.priority);
      else row.style.removeProperty('position');
    }
    entries.delete(row);
  }

  return {
    update(checkboxes) {
      const active = new Set();
      if (canShow()) checkboxes.forEach((checkbox, index) => {
        const wrapper = checkbox.parentElement;
        const row = wrapper?.parentElement;
        if (!row || !isModern(row) || row.querySelector('#index')) return;
        active.add(row);
        let entry = entries.get(row);
        if (entry && entry.checkbox !== checkbox) remove(row, entry), entry = null;
        if (!entry) {
          const id = `${prefix}-index-${runtimeId}-${++sequence}`;
          entry = {
            checkbox,
            badge: element('span', { class: `${prefix}-playlist-index`, 'aria-hidden': 'true' }),
            description: element('span', { class: `${prefix}-index-description`, id }),
          };
          entries.set(row, entry);
        }
        if (getComputedStyle(row).position === 'static') {
          entry.position = row.style.getPropertyValue('position');
          entry.priority = row.style.getPropertyPriority('position');
          row.style.position = 'relative';
        }
        if (entry.badge.parentElement !== row) row.append(entry.badge);
        if (entry.description.parentElement !== row) row.append(entry.description);
        const number = String(index + 1), description = label(index + 1);
        if (entry.badge.textContent !== number) entry.badge.textContent = number;
        if (entry.description.textContent !== description) entry.description.textContent = description;
        const tokens = (checkbox.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (!tokens.includes(entry.description.id)) checkbox.setAttribute('aria-describedby', [...tokens, entry.description.id].join(' '));
        row.setAttribute('data-msfy-indexed', '');
        row.toggleAttribute('data-msfy-selecting', selecting);
        const left = parseFloat(wrapper.style.left) || 0;
        const top = parseFloat(wrapper.style.top) || 0;
        const width = parseFloat(wrapper.style.width) || row.clientWidth;
        entry.badge.style.left = `${left + width - 8}px`;
        entry.badge.style.top = `${top + 8}px`;
      });
      for (const [row, entry] of entries) if (!active.has(row)) remove(row, entry);
    },
    setMode(value) {
      selecting = value;
      for (const row of entries.keys()) row.toggleAttribute('data-msfy-selecting', selecting);
    },
    clear() {
      for (const [row, entry] of entries) remove(row, entry);
    },
  };
}
