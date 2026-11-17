// Geometry is measured in viewport coordinates; labels are local CSS pixels.
const EPSILON = 0.75;
export const MAX_ITEMS = 80;
export function rect(x, y, width, height) {
  return { x, y, width, height, right: x + width, bottom: y + height };
}
export function intersect(a, b) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return rect(x, y, Math.max(0, Math.min(a.right, b.right) - x), Math.max(0, Math.min(a.bottom, b.bottom) - y));
}
function overlaps(a, b) {
  return Math.min(a.right, b.right) - Math.max(a.x, b.x) > EPSILON &&
    Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > EPSILON;
}
// Adjacent visible boxes, in visual order. No DOM-order or flex-direction assumptions.
export function findSpaces(items, bounds, scale = { x: 1, y: 1 }, obstacles = items) {
  const spaces = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      for (const axis of ['x', 'y']) {
        const horizontal = axis === 'x';
        const [first, next] = (horizontal ? a.x < b.x : a.y < b.y) ? [a, b] : [b, a];
        const start = horizontal ? first.right : first.bottom;
        const end = horizontal ? next.x : next.y;
        const crossStart = Math.max(horizontal ? first.y : first.x, horizontal ? next.y : next.x);
        const crossEnd = Math.min(horizontal ? first.bottom : first.right, horizontal ? next.bottom : next.right);
        if (end - start <= EPSILON || crossEnd - crossStart <= EPSILON) continue;
        const candidate = horizontal ? rect(start, crossStart, end - start, crossEnd - crossStart)
          : rect(crossStart, start, crossEnd - crossStart, end - start);
        // Never paint a spacing band through a third rendered item.
        if (obstacles.some(other => other !== a && other !== b && overlaps(candidate, other))) continue;
        const clipped = intersect(candidate, bounds);
        if (clipped.width <= EPSILON || clipped.height <= EPSILON) continue;
        if (spaces.some(s => s.axis === axis && Math.abs(s.rect.x - clipped.x) < EPSILON &&
          Math.abs(s.rect.y - clipped.y) < EPSILON && Math.abs(s.rect.width - clipped.width) < EPSILON &&
          Math.abs(s.rect.height - clipped.height) < EPSILON)) continue;
        spaces.push({ kind: 'space', axis, value: (end - start) / scale[axis], rect: clipped });
      }
    }
  }
  return spaces;
}
export function composedParent(element) {
  return element.assignedSlot || element.parentElement || element.getRootNode()?.host || null;
}
const number = value => Number.parseFloat(value) || 0;
const toRect = r => rect(r.x, r.y, r.width, r.height);
function renderedItems(element, exclude) {
  const items = [], obstacles = [];
  let overflow = false, text = false;
  function collect(parent) {
    const nodes = parent.localName === 'slot' ? parent.assignedNodes({ flatten: true }) : parent.childNodes;
    for (const node of nodes) {
      if (node.nodeType === 3 && node.textContent.trim()) { text = true; continue; }
      if (node.nodeType !== 1 || node === exclude) continue;
      const s = getComputedStyle(node);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') continue;
      if (s.display === 'contents' || node.localName === 'slot') { collect(node); continue; }
      if (obstacles.length >= MAX_ITEMS) { overflow = true; break; }
      const r = toRect(node.getBoundingClientRect());
      // Absolute children are obstacles too: avoid painting over them.
      if (r.width > EPSILON && r.height > EPSILON) {
        obstacles.push(r);
        if (!['absolute', 'fixed'].includes(s.position)) items.push(r);
      }
    }
  }
  collect(element.shadowRoot || element);
  return { items, obstacles, overflow, text };
}
function transformIssue(element) {
  for (let e = element; e; e = composedParent(e)) {
    const s = getComputedStyle(e);
    if (s.perspective !== 'none' || (s.rotate && !['none', '0deg'].includes(s.rotate))) return true;
    if (s.scale && s.scale !== 'none' && s.scale.split(' ').some(v => number(v) <= 0)) return true;
    if (s.transform !== 'none') {
      const m = new DOMMatrixReadOnly(s.transform);
      if (!m.is2D || Math.abs(m.b) > 0.0001 || Math.abs(m.c) > 0.0001 || m.a <= 0 || m.d <= 0) return true;
    }
  }
  return false;
}
function clipping(element, viewport) {
  let clip = viewport;
  for (let e = composedParent(element); e; e = composedParent(e)) {
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    const sx = r.width / (e.offsetWidth || r.width || 1), sy = r.height / (e.offsetHeight || r.height || 1);
    const inner = rect(r.x + e.clientLeft * sx, r.y + e.clientTop * sy, e.clientWidth * sx, e.clientHeight * sy);
    const clipsX = /hidden|clip|scroll|auto/.test(s.overflowX), clipsY = /hidden|clip|scroll|auto/.test(s.overflowY);
    if (clipsX) clip = intersect(clip, rect(inner.x, clip.y, inner.width, clip.height));
    if (clipsY) clip = intersect(clip, rect(clip.x, inner.y, clip.width, inner.height));
  }
  return clip;
}
export function measure(element, exclude) {
  const viewport = rect(0, 0, window.innerWidth, window.innerHeight);
  const outer = toRect(element.getBoundingClientRect());
  const output = { outer, outline: intersect(outer, clipping(element, viewport)), bands: [], warnings: [] };
  if (!outer.width || !outer.height) { output.warnings.push('This element has no rendered box. Select its parent.'); return output; }
  if (!(element instanceof HTMLElement) || transformIssue(element)) {
    output.warnings.push('Rotated, skewed, mirrored, 3D and SVG geometry is not supported.'); return output;
  }
  const s = getComputedStyle(element);
  if (s.display === 'contents' || element.getClientRects().length > 1 || s.display === 'inline') {
    output.warnings.push('Inline fragments have no single spacing box. Select a layout container.'); return output;
  }
  if ((s.columnCount !== 'auto' && number(s.columnCount) > 1) || s.columnWidth !== 'auto') {
    output.warnings.push('Multi-column text flow is not supported.'); return output;
  }
  const p = { t: number(s.paddingTop), r: number(s.paddingRight), b: number(s.paddingBottom), l: number(s.paddingLeft) };
  const b = { t: number(s.borderTopWidth), r: number(s.borderRightWidth), b: number(s.borderBottomWidth), l: number(s.borderLeftWidth) };
  const width = number(s.width) + (s.boxSizing === 'border-box' ? 0 : p.l + p.r + b.l + b.r);
  const height = number(s.height) + (s.boxSizing === 'border-box' ? 0 : p.t + p.b + b.t + b.b);
  const scale = { x: outer.width / (width || element.offsetWidth || outer.width), y: outer.height / (height || element.offsetHeight || outer.height) };
  const paddingBox = rect(outer.x + b.l * scale.x, outer.y + b.t * scale.y,
    Math.max(0, outer.width - (b.l + b.r) * scale.x), Math.max(0, outer.height - (b.t + b.b) * scale.y));
  const content = rect(paddingBox.x + p.l * scale.x, paddingBox.y + p.t * scale.y,
    Math.max(0, paddingBox.width - (p.l + p.r) * scale.x), Math.max(0, paddingBox.height - (p.t + p.b) * scale.y));
  const clip = intersect(clipping(element, viewport), paddingBox);
  const add = (value, area, axis) => { const r = intersect(area, clip); if (value && r.width > EPSILON && r.height > EPSILON) output.bands.push({ kind: 'padding', value, axis, rect: r }); };
  // A scrolled padding area is not fixed to the visible container edge.
  if (!element.scrollTop && !element.scrollLeft && element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1) {
    add(p.t, rect(paddingBox.x, paddingBox.y, paddingBox.width, p.t * scale.y), 'y');
    add(p.b, rect(paddingBox.x, content.bottom, paddingBox.width, p.b * scale.y), 'y');
    add(p.l, rect(paddingBox.x, content.y, p.l * scale.x, content.height), 'x');
    add(p.r, rect(content.right, content.y, p.r * scale.x, content.height), 'x');
  } else output.warnings.push(`${element.scrollTop || element.scrollLeft ? 'Scrolled' : 'Scrollable'} container: padding bands are hidden; child spacing remains measurable.`);
  const { items, obstacles, overflow, text } = renderedItems(element, exclude);
  const generated = ['::before', '::after'].some(pseudo => { const style = getComputedStyle(element, pseudo); return !['none', 'normal'].includes(style.content) && style.display !== 'none'; });
  if (overflow) output.warnings.push(`More than ${MAX_ITEMS} child boxes: spacing is not measured.`);
  else if (text) output.warnings.push('Direct text nodes: child spacing is not measured. Select a nested layout.');
  else if (generated) output.warnings.push('Generated content: child spacing is not measured.');
  else output.bands.push(...findSpaces(items, intersect(content, clip), scale, obstacles));
  if (['iframe', 'canvas', 'video'].includes(element.localName)) output.warnings.push('Embedded content is inspected as one box; its contents are not accessible.');
  if (s.clipPath !== 'none' || s.maskImage !== 'none') output.warnings.push('Clipping paths and masks are approximated by rectangular bounds.');
  return output;
}
