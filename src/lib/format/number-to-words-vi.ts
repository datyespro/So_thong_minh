export function vietnameseAmountInWords(amount: number): string {
  if (amount === 0) return "Không đồng.";

  const isNegative = amount < 0;
  const isChẵn = Math.abs(Math.round(amount)) % 1000 === 0;
  let absStr = Math.abs(Math.round(amount)).toString();

  // Pad to multiple of 3
  while (absStr.length % 3 !== 0) {
    absStr = "0" + absStr;
  }

  const groups: number[] = [];
  for (let i = 0; i < absStr.length; i += 3) {
    groups.push(parseInt(absStr.substring(i, i + 3), 10));
  }

  const units = ["", "nghìn", "triệu", "tỷ"];
  let result = "";

  const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

  function readGroup(n: number, full: boolean): string {
    let res = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (full || h > 0) {
      res += DIGITS[h] + " trăm ";
    }

    if (t > 1) {
      res += DIGITS[t] + " mươi ";
      if (u === 1) res += "mốt ";
      else if (u === 5) res += "lăm ";
      else if (u === 4) res += "tư ";
      else if (u > 0) res += DIGITS[u] + " ";
    } else if (t === 1) {
      res += "mười ";
      if (u === 5) res += "lăm ";
      else if (u > 0) res += DIGITS[u] + " ";
    } else {
      if ((full || h > 0) && u > 0) {
        res += "lẻ " + DIGITS[u] + " ";
      } else if (u > 0) {
        res += DIGITS[u] + " ";
      }
    }
    return res.replace(/\s+/g, " ").trim();
  }

  const len = groups.length;
  for (let i = 0; i < len; i++) {
    const group = groups[i];
    const isFirstNonZero = i === groups.findIndex(g => g > 0);
    const hasHigherGroup = !isFirstNonZero;

    const unitIndex = len - 1 - i;
    let unitStr = "";
    if (unitIndex > 0) {
      if (unitIndex % 3 === 0) {
        unitStr = "tỷ";
        for (let j = 0; j < (unitIndex / 3) - 1; j++) unitStr += " tỷ";
      } else {
        unitStr = units[unitIndex % 3];
      }
    }

    if (group > 0) {
      result += readGroup(group, hasHigherGroup) + " " + unitStr + " ";
    } else if (unitIndex % 3 === 0 && hasHigherGroup) {
      result += unitStr + " ";
    }
  }

  let finalString = result.replace(/\s+/g, " ").trim();
  if (isNegative) finalString = "âm " + finalString;

  finalString = finalString.charAt(0).toUpperCase() + finalString.slice(1);

  if (isChẵn) {
    finalString += " đồng chẵn.";
  } else {
    finalString += " đồng.";
  }

  return finalString;
}
