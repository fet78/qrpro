import {
  Flame, Wrench, Droplet, Droplets, Thermometer, ThermometerSun, Snowflake, Fan, Zap, Plug, Heater, AirVent, Gauge, Settings, Hammer,
  ShowerHead, Bath, House, Building2, Factory, Sun, Leaf, Recycle, ShieldCheck, BadgeCheck, CircleCheck, Award, Star, Phone, Smartphone,
  Mail, Globe, MapPin, Calendar, CalendarCheck, Clock, ScanLine, QrCode, Hand, ArrowRight, MessageCircle, TriangleAlert, Info, Wind, Truck, User,
} from "lucide";

/**
 * Icônes de la bibliothèque (Lucide, licence ISC), converties en un seul tracé SVG
 * dans une boîte de 24 × 24, dessinées au trait. Même tracé pour l'aperçu, le SVG et le PDF.
 */
type Node = [string, Record<string, string | number>];

function nodeToPath([tag, a]: Node): string {
  const v = (k: string) => Number(a[k] ?? 0);
  switch (tag) {
    case "path":
      return String(a.d);
    case "circle": {
      const [cx, cy, r] = [v("cx"), v("cy"), v("r")];
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
    }
    case "ellipse": {
      const [cx, cy, rx, ry] = [v("cx"), v("cy"), v("rx"), v("ry")];
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
    }
    case "line":
      return `M${v("x1")} ${v("y1")}L${v("x2")} ${v("y2")}`;
    case "rect": {
      const [x, y, w, h] = [v("x"), v("y"), v("width"), v("height")];
      const r = Math.min(v("rx") || v("ry"), w / 2, h / 2);
      if (!r) return `M${x} ${y}h${w}v${h}h${-w}z`;
      return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
    }
    case "polyline":
    case "polygon": {
      const pts = String(a.points).trim().split(/[\s,]+/).map(Number);
      let d = "";
      for (let i = 0; i < pts.length; i += 2) d += `${i ? "L" : "M"}${pts[i]} ${pts[i + 1]}`;
      return tag === "polygon" ? `${d}z` : d;
    }
    default:
      return "";
  }
}

const SOURCE: Record<string, { label: string; group: string; node: unknown }> = {
  flame: { label: "Flamme", group: "Chauffage", node: Flame },
  heater: { label: "Radiateur", group: "Chauffage", node: Heater },
  thermometer: { label: "Thermomètre", group: "Chauffage", node: Thermometer },
  "thermometer-sun": { label: "Chaleur", group: "Chauffage", node: ThermometerSun },
  gauge: { label: "Manomètre", group: "Chauffage", node: Gauge },
  sun: { label: "Solaire", group: "Énergie", node: Sun },
  leaf: { label: "Écologie", group: "Énergie", node: Leaf },
  recycle: { label: "Recyclage", group: "Énergie", node: Recycle },
  zap: { label: "Électricité", group: "Énergie", node: Zap },
  plug: { label: "Prise", group: "Énergie", node: Plug },
  snowflake: { label: "Froid", group: "Climatisation", node: Snowflake },
  fan: { label: "Ventilateur", group: "Climatisation", node: Fan },
  "air-vent": { label: "Bouche d'air", group: "Climatisation", node: AirVent },
  wind: { label: "Air", group: "Climatisation", node: Wind },
  droplet: { label: "Goutte", group: "Plomberie", node: Droplet },
  droplets: { label: "Eau", group: "Plomberie", node: Droplets },
  shower: { label: "Douche", group: "Plomberie", node: ShowerHead },
  bath: { label: "Bain", group: "Plomberie", node: Bath },
  wrench: { label: "Clé", group: "Outils", node: Wrench },
  hammer: { label: "Marteau", group: "Outils", node: Hammer },
  settings: { label: "Réglages", group: "Outils", node: Settings },
  house: { label: "Maison", group: "Lieux", node: House },
  building: { label: "Immeuble", group: "Lieux", node: Building2 },
  factory: { label: "Industrie", group: "Lieux", node: Factory },
  truck: { label: "Camion", group: "Lieux", node: Truck },
  "shield-check": { label: "Garantie", group: "Confiance", node: ShieldCheck },
  "badge-check": { label: "Certifié", group: "Confiance", node: BadgeCheck },
  "circle-check": { label: "Validé", group: "Confiance", node: CircleCheck },
  award: { label: "Qualité", group: "Confiance", node: Award },
  star: { label: "Étoile", group: "Confiance", node: Star },
  phone: { label: "Téléphone", group: "Contact", node: Phone },
  smartphone: { label: "Smartphone", group: "Contact", node: Smartphone },
  mail: { label: "Email", group: "Contact", node: Mail },
  globe: { label: "Site web", group: "Contact", node: Globe },
  "map-pin": { label: "Adresse", group: "Contact", node: MapPin },
  message: { label: "Message", group: "Contact", node: MessageCircle },
  user: { label: "Technicien", group: "Contact", node: User },
  calendar: { label: "Calendrier", group: "Entretien", node: Calendar },
  "calendar-check": { label: "Rendez-vous", group: "Entretien", node: CalendarCheck },
  clock: { label: "Horaires", group: "Entretien", node: Clock },
  "scan-line": { label: "Scanner", group: "Scan", node: ScanLine },
  "qr-code": { label: "QR code", group: "Scan", node: QrCode },
  hand: { label: "Main", group: "Scan", node: Hand },
  "arrow-right": { label: "Flèche", group: "Scan", node: ArrowRight },
  alert: { label: "Attention", group: "Scan", node: TriangleAlert },
  info: { label: "Information", group: "Scan", node: Info },
};

export const ICONS: Record<string, { label: string; group: string; d: string }> = Object.fromEntries(
  Object.entries(SOURCE).map(([key, s]) => [key, { label: s.label, group: s.group, d: (s.node as Node[]).map(nodeToPath).join("") }]),
);
export const ICON_KEYS = Object.keys(ICONS);
export const ICON_GROUPS = [...new Set(Object.values(ICONS).map((i) => i.group))];
