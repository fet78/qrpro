/** Relit chaque étiquette rastérisée avec jsQR et vérifie l'URL. Code de sortie 1 au moindre échec. */
import { readFileSync } from "node:fs";
import jsQR from "jsqr";

const slots: { url: string }[] = JSON.parse(readFileSync("tests/output/slots.json", "utf-8"));
let failures = 0;
slots.forEach((s, i) => {
  const { w, h } = JSON.parse(readFileSync(`tests/output/slots/${i}.json`, "utf-8"));
  const data = new Uint8ClampedArray(readFileSync(`tests/output/slots/${i}.raw`));
  const res = jsQR(data, w, h);
  const ok = res?.data === s.url;
  if (!ok) failures++;
  console.log(`${ok ? "OK " : "ÉCHEC"} #${i + 1} ${res?.data ?? "(illisible)"}`);
});
console.log(failures ? `${failures} échec(s)` : `Les ${slots.length} QR codes se relisent exactement.`);
process.exit(failures ? 1 : 0);
