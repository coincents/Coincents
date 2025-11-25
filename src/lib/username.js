export function generateDefaultUsername(ethereumAddress = "") {
  const base = "user";
  const addr = (ethereumAddress || "").toLowerCase();
  const a = addr.startsWith("0x") ? addr.slice(2) : addr;
  const left = a.slice(0, 4) || Math.random().toString(36).slice(2, 6);
  const right = a.slice(-4) || Math.random().toString(36).slice(2, 6);
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `${base}-${left}-${right}-${suffix}`;
}


