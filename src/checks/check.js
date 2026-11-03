// One verification result.
//
// `op` says which way the comparison runs: '<=' for an error that must stay
// under a tolerance, '>=' for a margin or clearance that must stay positive,
// '==' for a count that must match exactly, 'in' for a value that must fall
// inside [lo, hi].

export function check(id, name, value, op, limit, note) {
  let pass;
  if (op === '<=') pass = value <= limit;
  else if (op === '>=') pass = value >= limit;
  else if (op === '==') pass = value === limit;
  else if (op === 'in') pass = value >= limit[0] && value <= limit[1];
  else throw new Error(`unknown comparison ${op}`);
  if (typeof value === 'number' && Number.isNaN(value)) pass = false;
  return { id, name, value, op, limit, pass, ...(note ? { note } : {}) };
}

/** Largest absolute value a function takes over a list of inputs (NaN wins). */
export function worst(inputs, f) {
  let w = 0;
  for (const x of inputs) {
    const v = Math.abs(f(x));
    if (Number.isNaN(v)) return NaN;
    if (v > w) w = v;
  }
  return w;
}

/** Evenly spaced angles over one revolution. */
export function angles(N, from = 0, span = Math.PI * 2) {
  const out = new Array(N);
  for (let i = 0; i < N; i++) out[i] = from + (i / N) * span;
  return out;
}

/**
 * Minimum and maximum of a smooth periodic function of one angle: sampled,
 * then each extreme polished by golden-section search between the samples
 * either side of it. Reading extremes straight off samples would build the
 * sampling step into every stroke and swing measurement.
 */
export function extremes(f, N = 720) {
  const th = angles(N);
  const v = th.map(f);
  const polish = (i, sign) => {
    let a = th[i] - (2 * Math.PI) / N, b = th[i] + (2 * Math.PI) / N;
    const g = (Math.sqrt(5) - 1) / 2;
    let x1 = b - g * (b - a), x2 = a + g * (b - a);
    let f1 = sign * f(x1), f2 = sign * f(x2);
    for (let k = 0; k < 120 && b - a > 1e-13; k++) {
      if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = sign * f(x1); }
      else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = sign * f(x2); }
    }
    return Math.min(sign * v[i], f1, f2) * sign;
  };
  let iMin = 0, iMax = 0;
  for (let i = 1; i < N; i++) { if (v[i] < v[iMin]) iMin = i; if (v[i] > v[iMax]) iMax = i; }
  return { min: polish(iMin, 1), max: polish(iMax, -1) };
}
