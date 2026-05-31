export function normalizeVi(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

export function trigramSet(input: string): Set<string> {
  const normalized = normalizeVi(input);

  if (!normalized) {
    return new Set();
  }

  const padded = `  ${normalized} `;
  const trigrams = new Set<string>();

  for (let index = 0; index <= padded.length - 3; index += 1) {
    trigrams.add(padded.slice(index, index + 3));
  }

  return trigrams;
}

export function diceSimilarity(a: string, b: string): number {
  const aTrigrams = trigramSet(a);
  const bTrigrams = trigramSet(b);

  if (aTrigrams.size === 0 || bTrigrams.size === 0) {
    return 0;
  }

  let intersectionCount = 0;

  for (const trigram of aTrigrams) {
    if (bTrigrams.has(trigram)) {
      intersectionCount += 1;
    }
  }

  return (2 * intersectionCount) / (aTrigrams.size + bTrigrams.size);
}
