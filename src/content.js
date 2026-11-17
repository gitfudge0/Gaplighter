import { measure, composedParent } from './geometry.js';
import css from './overlay.css';

const api = globalThis.browser || globalThis.chrome;
const KEY = '__gaplighterInspectorV1';
// Re-injection must not register a second inspector or a second message handler.
if (!globalThis[KEY]) {
  const inspector = createInspector();
  globalThis[KEY] = inspector;
  api.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'gaplighter:status') respond({ active: inspector.active });
    if (message?.type === 'gaplighter:toggle') {
      if (inspector.active) inspector.stop(); else inspector.start();
      respond({ active: inspector.active });
    }
  });
}

function createInspector() {
  let active = false, frozen = false, selected = null, mode = 'container';
  let host, shadow, bands, panel, status, name, summary, warning, freeze, parent, target;
  let frame = 0, last = 0, previous = '', pointer = null;
  const abort = () => stop();
  function owned(event) { return event.composedPath().includes(host); }
  function pick(element) {
    if (!(element instanceof Element) || element === host) return null;
    if (mode === 'element') return element;
    const original = element;
    // Avoid turning an ordinary paragraph hover into selection of the whole page.
    for (let e = element; e && !['body', 'html'].includes(e.localName); e = composedParent(e)) {
      if (e === host) return null;
      const s = getComputedStyle(e);
      let count = 0;
      for (const c of e.shadowRoot?.children || e.children) {
        const cs = getComputedStyle(c);
        if (cs.display !== 'none' && cs.visibility !== 'hidden') count++;
        if (count >= 2) break;
      }
      if (count >= 2 && !['inline', 'contents'].includes(s.display)) return e;
    }
    return original;
  }
  function eventElement(event) { return event.composedPath().find(node => node instanceof Element); }
  function move(event) {
    if (owned(event) || frozen) return;
    pointer = { x: event.clientX, y: event.clientY };
    selected = pick(eventElement(event));
    previous = '';
  }
  function click(event) {
    if (owned(event)) return;
    // Inspection clicks must not follow links, submit forms or trigger page handlers.
    event.preventDefault(); event.stopImmediatePropagation();
    if (!frozen) selected = pick(eventElement(event));
    frozen = !frozen; previous = '';
  }
  function key(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); stop(); return; }
    if (owned(event) || event.ctrlKey || event.metaKey || event.altKey) return;
    const element = eventElement(event);
    if (element?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    if (event.key === 'ArrowUp') { event.preventDefault(); event.stopImmediatePropagation(); selectParent(); }
    if (event.key === 'Enter' && selected) { event.preventDefault(); event.stopImmediatePropagation(); frozen = !frozen; previous = ''; }
  }
  function selectParent() {
    if (!selected) return;
    const next = composedParent(selected);
    if (next && next !== host) { selected = next; frozen = true; previous = ''; }
  }
  function mount() {
    host = document.createElement('div');
    host.id = 'gaplighter-inspector';
    host.setAttribute('popover', 'manual');
    host.setAttribute('aria-label', 'Gaplighter spacing inspector');
    // Critical host properties also resist page !important rules targeting divs.
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;margin:0!important;padding:0!important;border:0!important;width:100vw!important;height:100vh!important;background:transparent!important;pointer-events:none!important;overflow:visible!important;z-index:2147483647!important;';
    shadow = host.attachShadow({ mode: 'open' });
    const stylesheet = new CSSStyleSheet(); stylesheet.replaceSync(css);
    shadow.adoptedStyleSheets = [stylesheet];
    bands = document.createElement('div'); bands.setAttribute('aria-hidden', 'true'); shadow.append(bands);
    panel = document.createElement('section'); panel.className = 'panel'; panel.setAttribute('aria-label', 'Spacing controls');
    // Static markup only. Page-derived names and measurements use textContent.
    panel.innerHTML = '<div class="header"><div class="brand">Gap<span>lighter</span></div><button class="close" aria-label="Exit inspection">×</button></div><div class="state" role="status"></div><div class="selected"></div><div class="summary"></div><div class="warning"></div><div class="controls"><button id="freeze">Freeze</button><button id="parent">Parent ↑</button><button id="move">Move controls</button><select aria-label="Targeting mode"><option value="container">Containers</option><option value="element">Exact element</option></select></div><p class="hint">Hover to inspect · click / Enter to freeze · ↑ parent · Esc exit. Labels are CSS px; spacing includes margins and layout distribution.</p>';
    shadow.append(panel);
    status = panel.querySelector('.state'); name = panel.querySelector('.selected'); summary = panel.querySelector('.summary'); warning = panel.querySelector('.warning');
    freeze = panel.querySelector('#freeze'); parent = panel.querySelector('#parent'); target = panel.querySelector('select');
    panel.querySelector('.close').onclick = abort;
    freeze.onclick = () => { frozen = !frozen; previous = ''; };
    parent.onclick = selectParent;
    let dockBottom = false;
    panel.querySelector('#move').onclick = () => {
      dockBottom = !dockBottom;
      Object.assign(panel.style, dockBottom ? { top: 'auto', right: 'auto', bottom: '16px', left: '16px' } : { top: '16px', right: '16px', bottom: 'auto', left: 'auto' });
    };
    target.onchange = () => { mode = target.value; if (selected) selected = pick(selected); previous = ''; };
    // Keep toolbar events out of the host page's bubbling listeners.
    for (const type of ['click', 'pointerdown', 'pointerup', 'keydown', 'keyup']) panel.addEventListener(type, e => e.stopPropagation());
    // Escape still works while a toolbar control is focused.
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') stop(); });
    document.documentElement.append(host);
    host.showPopover();
  }
  function start() {
    if (active) return;
    active = true; frozen = false; selected = null; pointer = null; mode = 'container'; previous = ''; last = 0;
    mount();
    document.addEventListener('pointermove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', blockPointer, true);
    document.addEventListener('pointerup', blockPointer, true);
    window.addEventListener('pagehide', abort);
    frame = requestAnimationFrame(tick);
  }
  function blockPointer(event) { if (!owned(event)) { event.preventDefault(); event.stopImmediatePropagation(); } }
  function stop() {
    active = false; cancelAnimationFrame(frame);
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('click', click, true);
    document.removeEventListener('keydown', key, true);
    document.removeEventListener('pointerdown', blockPointer, true);
    document.removeEventListener('pointerup', blockPointer, true);
    window.removeEventListener('pagehide', abort);
    host?.remove(); selected = null; pointer = null;
  }
  function tick(time) {
    if (!active) return;
    if (!host.isConnected) { stop(); return; }
    if (time - last >= 80 && document.visibilityState !== 'hidden') {
      last = time;
      // Re-hit-test when a page moves underneath a stationary pointer.
      if (!frozen && pointer) {
        let hit = document.elementFromPoint(pointer.x, pointer.y);
        while (hit?.shadowRoot?.elementFromPoint) {
          const nested = hit.shadowRoot.elementFromPoint(pointer.x, pointer.y);
          if (!nested || nested === hit) break;
          hit = nested;
        }
        if (hit && hit !== host) selected = pick(hit);
      }
      if (selected && !selected.isConnected) { selected = null; frozen = false; }
      const result = selected ? measure(selected, host) : null;
      const label = selected ? `${selected.localName}${selected.id ? '#' + selected.id.slice(0, 80) : ''}` : 'Hover over a component';
      const signature = JSON.stringify([result, label, frozen, mode]);
      if (signature !== previous) { previous = signature; render(result, label); }
    }
    frame = requestAnimationFrame(tick);
  }
  function render(result, label) {
    bands.replaceChildren();
    status.textContent = frozen ? 'Selection frozen' : 'Following hover';
    name.textContent = label;
    freeze.textContent = frozen ? 'Resume' : 'Freeze'; freeze.disabled = !selected;
    parent.disabled = !selected || !composedParent(selected);
    target.value = mode;
    if (!result) { summary.textContent = 'Pink bands reveal padding and visible spacing.'; warning.textContent = ''; return; }
    const place = (el, r) => { Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` }); };
    if (result.outline.width && result.outline.height) { const el = document.createElement('div'); el.className = 'outline'; place(el, result.outline); bands.append(el); }
    for (const band of result.bands.slice(0, 160)) {
      const el = document.createElement('div'); el.className = 'band'; el.dataset.kind = band.kind; el.dataset.value = String(band.value); place(el, band.rect);
      if (band.rect.width >= 14 && band.rect.height >= 12) {
        const text = document.createElement('span'); text.className = 'label'; text.textContent = String(Math.round(band.value * 10) / 10); el.append(text);
      }
      bands.append(el);
    }
    const spaces = [...new Set(result.bands.filter(b => b.kind === 'space').map(b => Math.round(b.value * 10) / 10))];
    const padding = [...new Set(result.bands.filter(b => b.kind === 'padding').map(b => Math.round(b.value * 10) / 10))];
    summary.textContent = `Padding: ${padding.length ? padding.join(', ') + ' px' : 'none visible'}. Spacing: ${spaces.length ? spaces.slice(0, 12).join(', ') + ' px' : 'none measured'}.`;
    warning.textContent = [...result.warnings, ...(result.bands.length > 160 ? ['Only the first 160 bands are shown.'] : [])].join(' ');
  }
  return { get active() { return active; }, start, stop };
}
