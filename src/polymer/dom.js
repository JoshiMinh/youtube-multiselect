// Construct extension UI without parsing HTML or installing a page-wide trust policy.
export function element(tag, attributes = {}, ...children) {
  return populate(document.createElement(tag), attributes, children);
}

export function svg(tag, attributes = {}, ...children) {
  return populate(document.createElementNS('http://www.w3.org/2000/svg', tag), attributes, children);
}

function populate(node, attributes, children) {
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== false && value != null) node.setAttribute(name, value === true ? '' : String(value));
  }
  node.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  return node;
}

export function dragHandle() {
  return element('div', { id: 'drag-handle' }, element('hr'), element('hr'));
}
