const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));

export function toolbarMenuPosition(anchor, menu, viewport) {
  const gap = 8, margin = 8;
  const above = Math.max(0, anchor.top - gap - margin);
  const below = Math.max(0, viewport.height - anchor.bottom - gap - margin);
  const opensAbove = menu.height <= above || above >= below;
  const maxHeight = opensAbove ? above : below;
  const height = Math.min(menu.height, maxHeight);
  return {
    left: clamp(anchor.right - menu.width, margin, viewport.width - margin - menu.width),
    top: clamp(opensAbove ? anchor.top - gap - height : anchor.bottom + gap, margin, viewport.height - margin - height),
    maxHeight,
    placement: opensAbove ? 'above' : 'below',
  };
}

export function anchorToolbarMenu(menu, toolbar) {
  const list = menu.firstElementChild;
  let frame = 0;
  function position() {
    frame = 0;
    if (!menu.isConnected || !toolbar.isConnected) return;
    const scrollTop = list.scrollTop;
    list.style.maxHeight = 'none';
    const layout = toolbarMenuPosition(toolbar.getBoundingClientRect(), list.getBoundingClientRect(), { width: innerWidth, height: innerHeight });
    menu.style.left = `${layout.left}px`;
    menu.style.top = `${layout.top}px`;
    menu.dataset.placement = layout.placement;
    list.style.maxHeight = `${layout.maxHeight}px`;
    list.scrollTop = scrollTop;
  }
  const update = () => { if (!frame) frame = requestAnimationFrame(position); };
  const onScroll = (event) => {
    if (!(event.target instanceof Node && menu.contains(event.target))) update();
  };
  const observer = new ResizeObserver(update);
  observer.observe(toolbar);
  observer.observe(list);
  window.addEventListener('resize', update);
  window.addEventListener('scroll', onScroll, true);
  position();
  return {
    update,
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', onScroll, true);
    },
  };
}
