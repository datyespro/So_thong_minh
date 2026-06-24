export function normalizeVi(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

// So kh\u1edbp ph\u00e2n bi\u1ec7t D\u1ea4U: h\u1ea1 th\u01b0\u1eddng + NFC + gom space + trim, GI\u1eee d\u1ea5u ti\u1ebfng Vi\u1ec7t.
export function foldCaseVi(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFC")
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
