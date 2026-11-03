// Small SVG helpers for the demo page. Drawing only: nothing here is used by
// the checks.

const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

const f = (v) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(2));

/** Path data for a polyline or polygon. */
export function pathD(points, closed = true) {
  if (!points.length) return '';
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 1; i < points.length; i++) d += `L${f(points[i][0])} ${f(points[i][1])}`;
  return closed ? d + 'Z' : d;
}

/** Path data for a circle (two arcs), so circles can share a path with holes. */
export function circleD(c, r) {
  return `M${f(c[0] + r)} ${f(c[1])}A${f(r)} ${f(r)} 0 1 0 ${f(c[0] - r)} ${f(c[1])}A${f(r)} ${f(r)} 0 1 0 ${f(c[0] + r)} ${f(c[1])}Z`;
}

/** A link with round ends from (x0, y0) to (x0 + len, y0), width w. */
export function capsuleD(len, w, x0 = 0, y0 = 0) {
  const h = w / 2;
  return `M${f(x0)} ${f(y0 - h)}L${f(x0 + len)} ${f(y0 - h)}A${f(h)} ${f(h)} 0 0 1 ${f(x0 + len)} ${f(y0 + h)}` +
    `L${f(x0)} ${f(y0 + h)}A${f(h)} ${f(h)} 0 0 1 ${f(x0)} ${f(y0 - h)}Z`;
}

export function rectD(x, y, w, h) {
  return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
}

/** Transform string for a rigid body at (x, y) turned by ang radians. */
export function pose(x, y, ang = 0) {
  return `translate(${f(x)} ${f(y)}) rotate(${((ang * 180) / Math.PI).toFixed(3)})`;
}

/** Centre mark: two short crossing lines. */
export function centreMark(parent, c, size) {
  el('path', { d: `M${f(c[0] - size)} ${f(c[1])}H${f(c[0] + size)}M${f(c[0])} ${f(c[1] - size)}V${f(c[1] + size)}`, class: 'centre' }, parent);
}

/** A fixed pivot: hatched block under a pin. */
export function groundPivot(parent, c, w = 16, h = 7, dir = 1) {
  const y = dir > 0 ? c[1] + 3 : c[1] - 3 - h;
  el('path', { d: rectD(c[0] - w / 2, y, w, h), class: 'ground' }, parent);
  el('path', { d: `M${f(c[0] - w / 2 - 2)} ${f(dir > 0 ? y : y + h)}H${f(c[0] + w / 2 + 2)}`, class: 'ground-edge' }, parent);
}
