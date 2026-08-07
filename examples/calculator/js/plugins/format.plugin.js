// Demo JS plugin — proves the plugins → backend.<name>.<fn>() round trip
// end-to-end in a real running example (this feature had zero example
// coverage before, only unit tests). Deliberately trivial and capability-free
// (pure computation, no fs/network/etc.) so it doesn't tangle with the
// separate capability-gating work.

// Converts a decimal string to its closest simple fraction via the
// standard continued-fraction algorithm.
export async function toFraction(args) {
  const value = parseFloat(args && args.value);
  if (!isFinite(value)) {
    return { fraction: String(args && args.value), exact: false };
  }
  if (Number.isInteger(value)) {
    return { fraction: String(value), exact: true };
  }

  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const maxDenominator = 100000;
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
  let b = x;
  do {
    const a = Math.floor(b);
    let aux = h1; h1 = a * h1 + h2; h2 = aux;
    aux = k1; k1 = a * k1 + k2; k2 = aux;
    if (Math.abs(b - a) < 1e-9) break;
    b = 1 / (b - a);
  } while (k1 <= maxDenominator);

  const numerator = sign * h1;
  const denominator = k1;
  const reconstructed = numerator / denominator;
  const exact = Math.abs(reconstructed - value) < 1e-9;
  return { fraction: numerator + '/' + denominator, exact };
}
