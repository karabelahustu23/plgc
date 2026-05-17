import { logger } from "./logger";

const BASE_URL = "https://api.esimaccess.com/api/v1/open";
const ACCESS_CODE = process.env.ESIMACCESS_API_KEY || "";

async function esimRequest<T>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "RT-AccessCode": ACCESS_CODE,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    logger.error({ status: response.status, url }, "esimaccess request failed");
    throw new Error(`esimaccess error: ${response.status}`);
  }

  const data = (await response.json()) as {
    success: boolean;
    obj: T;
    errorCode?: string;
    errorMsg?: string;
  };

  if (!data.success) {
    logger.error(
      { errorCode: data.errorCode, errorMsg: data.errorMsg, path },
      "esimaccess API error",
    );
    throw new Error(data.errorMsg || "esimaccess API error");
  }

  return data.obj;
}

// ─── Interfaces (gerçek API response'una göre) ───────────────────────────────

export interface LocationNetwork {
  locationName: string;
  locationLogo: string;
  locationCode: string;
  operatorList: Array<{
    operatorName: string;
    networkType: string; // "3G/4G/5G" gibi
  }>;
}

export interface EsimAccessPackage {
  packageCode: string;
  slug?: string;
  name: string;
  description?: string;
  price: number; // USD cent cinsinden (18000 = $18.00)
  retailPrice: number;
  currencyCode: string;
  volume: number; // bytes cinsinden
  smsStatus: number; // 1=destekli, 2=desteksiz
  dataType: number; // 1=data only
  unusedValidTime: number;
  duration: number;
  durationUnit: string; // "DAY"
  activeType: number; // 2=ilk kullanımda aktif
  favorite: boolean;
  locationCode: string;
  location?: string;
  speed?: string; // "3G/4G/5G"
  ipExport?: string; // "FR/NL"
  supportTopUpType?: number;
  fupPolicy?: string;
  locationNetworkList?: LocationNetwork[];
}

export interface EsimAccessProfile {
  iccid: string;
  smdpAddress: string;
  activationCode: string;
  qrCodeUrl: string;
  orderNo: string;
}

export interface EsimAccessUsage {
  iccid: string;
  smsStatus: number;
  msisdn: string;
  imsi: string;
  totalVolume: number;
  usedVolume: number;
  residualVolume: number;
  expiredTime: string;
  operatorName: string;
  validityDay: number;
  totalDay: number;
  orderNo: string;
  dataType: number;
  locationInfoList?: Array<{
    countryCode: string;
    name: string;
    usedVolume: number;
    totalVolume: number;
  }>;
}

export interface EsimOrderResult {
  orderNo: string;
  esimList: Array<{
    iccid: string;
    qrCode: string;
    activationCode: string;
    smdpAddress: string;
  }>;
}

// ─── API Fonksiyonları ────────────────────────────────────────────────────────

export async function listPackages(
  params: {
    locationCode?: string;
    type?: string;
    packageCode?: string;
    iccid?: string;
    slug?: string;
  } = {},
): Promise<{ packageList: EsimAccessPackage[]; count: number }> {
  return esimRequest("/package/list", {
    locationCode: params.locationCode ?? "",
    type: params.type ?? "", // boş = hepsini getir, "BASE" ile kısıtlama
    packageCode: params.packageCode ?? "",
    iccid: params.iccid ?? "",
    slug: params.slug ?? "",
  });
}

export async function orderEsim(
  packageCode: string,
  wholesalePrice: number,
  transactionId: string,
): Promise<EsimOrderResult> {
  return esimRequest("/esim/order", {
    transactionId,
    amount: 1,
    packageInfoList: [{ packageCode, count: 1, price: wholesalePrice }],
  });
}

export async function queryEsimByOrderNo(
  orderNo: string,
): Promise<EsimOrderResult> {
  return esimRequest("/order/query", { orderNo });
}

export async function queryEsimUsage(iccid: string): Promise<EsimAccessUsage> {
  return esimRequest("/esim/usage", { iccid });
}

export async function queryEsimProfile(
  iccid: string,
): Promise<EsimAccessProfile> {
  return esimRequest("/esim/query", { iccid });
}

export async function queryBalance(): Promise<{
  balance: number;
  currencyCode: string;
}> {
  return esimRequest("/balance/query");
}

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

/** Bytes → GB (2 ondalık) */
export function bytesToGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}

/** API cent → dolar/euro (2 ondalık) */
export function centsToAmount(cents: number): string {
  return (cents / 10000).toFixed(2);
}

/** Paketteki tüm operatörleri düz liste olarak döner */
export function getOperators(pkg: EsimAccessPackage): string[] {
  return (pkg.locationNetworkList ?? []).flatMap((loc) =>
    loc.operatorList.map((op) => op.operatorName),
  );
}

/** Paketteki network tipini döner ("3G/4G/5G" gibi) */
export function getNetworkType(pkg: EsimAccessPackage): string {
  return (
    pkg.speed ??
    pkg.locationNetworkList?.[0]?.operatorList?.[0]?.networkType ??
    ""
  );
}

// ─── Ülke / Bayrak Haritaları ────────────────────────────────────────────────

export const COUNTRY_NAME_MAP: Record<string, string> = {
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AD: "Andorra",
  AO: "Angola",
  AG: "Antigua & Barbuda",
  AR: "Argentina",
  AM: "Armenia",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BY: "Belarus",
  BE: "Belgium",
  BZ: "Belize",
  BJ: "Benin",
  BT: "Bhutan",
  BO: "Bolivia",
  BA: "Bosnia & Herzegovina",
  BW: "Botswana",
  BR: "Brazil",
  BN: "Brunei",
  BG: "Bulgaria",
  BF: "Burkina Faso",
  BI: "Burundi",
  KH: "Cambodia",
  CM: "Cameroon",
  CA: "Canada",
  CF: "Central African Republic",
  TD: "Chad",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  CG: "Congo",
  CD: "Congo (DRC)",
  CR: "Costa Rica",
  HR: "Croatia",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  DM: "Dominica",
  DO: "Dominican Republic",
  EC: "Ecuador",
  EG: "Egypt",
  SV: "El Salvador",
  EE: "Estonia",
  ET: "Ethiopia",
  FJ: "Fiji",
  FI: "Finland",
  FR: "France",
  GA: "Gabon",
  GM: "Gambia",
  GE: "Georgia",
  DE: "Germany",
  GH: "Ghana",
  GR: "Greece",
  GD: "Grenada",
  GL: "Greenland",
  GP: "Guadeloupe",
  GU: "Guam",
  GT: "Guatemala",
  GN: "Guinea",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HT: "Haiti",
  HN: "Honduras",
  HK: "Hong Kong",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",
  JM: "Jamaica",
  JP: "Japan",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KG: "Kyrgyzstan",
  KW: "Kuwait",
  LA: "Laos",
  LV: "Latvia",
  LB: "Lebanon",
  LR: "Liberia",
  LY: "Libya",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",
  MO: "Macao",
  MK: "North Macedonia",
  MG: "Madagascar",
  MW: "Malawi",
  MY: "Malaysia",
  MV: "Maldives",
  ML: "Mali",
  MT: "Malta",
  MQ: "Martinique",
  MR: "Mauritania",
  MU: "Mauritius",
  MX: "Mexico",
  MD: "Moldova",
  MC: "Monaco",
  MN: "Mongolia",
  ME: "Montenegro",
  MA: "Morocco",
  MZ: "Mozambique",
  MM: "Myanmar",
  NA: "Namibia",
  NP: "Nepal",
  NL: "Netherlands",
  NZ: "New Zealand",
  NI: "Nicaragua",
  NE: "Niger",
  NG: "Nigeria",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PA: "Panama",
  PG: "Papua New Guinea",
  PY: "Paraguay",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  PR: "Puerto Rico",
  QA: "Qatar",
  RE: "Réunion",
  RO: "Romania",
  RU: "Russia",
  RW: "Rwanda",
  KN: "Saint Kitts & Nevis",
  LC: "Saint Lucia",
  VC: "Saint Vincent",
  WS: "Samoa",
  SM: "San Marino",
  SC: "Seychelles",
  SL: "Sierra Leone",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  ZA: "South Africa",
  ES: "Spain",
  LK: "Sri Lanka",
  SD: "Sudan",
  SR: "Suriname",
  SZ: "Eswatini",
  SE: "Sweden",
  CH: "Switzerland",
  TW: "Taiwan",
  TJ: "Tajikistan",
  TZ: "Tanzania",
  TH: "Thailand",
  TT: "Trinidad & Tobago",
  TN: "Tunisia",
  TR: "Turkey",
  UG: "Uganda",
  UA: "Ukraine",
  AE: "UAE",
  GB: "United Kingdom",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VA: "Vatican City",
  VE: "Venezuela",
  VN: "Vietnam",
  YE: "Yemen",
  ZM: "Zambia",
  ZW: "Zimbabwe",
  "EU-42": "Europe (42)",
  "EU-30": "Europe (30)",
  "EU-35": "Europe (35)",
  "EU-43": "Europe (43)",
  "EU-7": "Europe (7)",
  "NA-3": "North America (3)",
  "SA-18": "South America (18)",
  "AF-29": "Africa (29)",
  "AS-7": "Asia (7)",
  "AS-5": "Asia (5)",
  "AS-12": "Asia (12)",
  "AS-20": "Asia (20)",
  "AS-21": "Asia (21)",
  "ME-6": "Middle East (6)",
  "ME-12": "Middle East (12)",
  "ME-13": "Middle East (13)",
  "CB-25": "Caribbean (25)",
  "GL-120": "Global (120)",
  "GL-139": "Global (139)",
  "SGMY-2": "Singapore & Malaysia",
  "AUNZ-2": "Australia & NZ",
  "USCA-2": "US & Canada",
  "JPKR-2": "Japan & Korea",
  "CNHK-2": "China & HK",
  "SGMYTH-3": "SG, MY & Thailand",
  "SGMYVNTHID-5": "SE Asia (5)",
  "AUKUS-3": "AU, UK & US",
  "IESI-2": "IE & SI",
  "CNJPKR-3": "CN, JP & KR",
  "SAAEQAKWOMBH-6": "Middle East (6)",
  "CN-3": "China (3)",
  "CA-4": "Canada (4)",
  "BI-2": "Burundi (2)",
  "O-OC-3": "Oceania (3)",
  AX: "Åland Islands",
  IM: "Isle of Man",
  JE: "Jersey",
  GG: "Guernsey",
  GI: "Gibraltar",
  AI: "Anguilla",
  BM: "Bermuda",
  VG: "British Virgin Islands",
  KY: "Cayman Islands",
  MS: "Montserrat",
  TC: "Turks & Caicos",
  CW: "Curaçao",
  BL: "Saint Barthélemy",
  MF: "Saint Martin",
  YT: "Mayotte",
  GF: "French Guiana",
  PF: "French Polynesia",
  FO: "Faroe Islands",
  RS: "Serbia",
  CV: "Cape Verde",
};

const COUNTRY_FLAG_MAP: Record<string, string> = {
  TR: "🇹🇷",
  US: "🇺🇸",
  GB: "🇬🇧",
  DE: "🇩🇪",
  FR: "🇫🇷",
  IT: "🇮🇹",
  ES: "🇪🇸",
  JP: "🇯🇵",
  KR: "🇰🇷",
  CN: "🇨🇳",
  AU: "🇦🇺",
  CA: "🇨🇦",
  BR: "🇧🇷",
  IN: "🇮🇳",
  MX: "🇲🇽",
  RU: "🇷🇺",
  SA: "🇸🇦",
  AE: "🇦🇪",
  SG: "🇸🇬",
  TH: "🇹🇭",
  MY: "🇲🇾",
  ID: "🇮🇩",
  PH: "🇵🇭",
  VN: "🇻🇳",
  EG: "🇪🇬",
  ZA: "🇿🇦",
  NG: "🇳🇬",
  GH: "🇬🇭",
  GR: "🇬🇷",
  PT: "🇵🇹",
  NL: "🇳🇱",
  BE: "🇧🇪",
  CH: "🇨🇭",
  AT: "🇦🇹",
  PL: "🇵🇱",
  CZ: "🇨🇿",
  HU: "🇭🇺",
  RO: "🇷🇴",
  SE: "🇸🇪",
  NO: "🇳🇴",
  DK: "🇩🇰",
  FI: "🇫🇮",
  NZ: "🇳🇿",
  AR: "🇦🇷",
  CL: "🇨🇱",
  CO: "🇨🇴",
  PE: "🇵🇪",
  TW: "🇹🇼",
  HK: "🇭🇰",
  IL: "🇮🇱",
  IR: "🇮🇷",
  PK: "🇵🇰",
  BD: "🇧🇩",
  LK: "🇱🇰",
  NP: "🇳🇵",
  MM: "🇲🇲",
  KH: "🇰🇭",
  LA: "🇱🇦",
  KW: "🇰🇼",
  QA: "🇶🇦",
  BH: "🇧🇭",
  OM: "🇴🇲",
  JO: "🇯🇴",
  MA: "🇲🇦",
  TN: "🇹🇳",
  DZ: "🇩🇿",
  KE: "🇰🇪",
  TZ: "🇹🇿",
  ET: "🇪🇹",
  UG: "🇺🇬",
  GLOBAL: "🌍",
  EUROPE: "🇪🇺",
  ASIA: "🌏",
  AFRICA: "🌍",
  AMERICAS: "🌎",
};

export function getFlagEmoji(locationCode: string): string | null {
  return COUNTRY_FLAG_MAP[locationCode?.toUpperCase()] || null;
}

export function getCountryName(locationCode: string): string {
  return COUNTRY_NAME_MAP[locationCode?.toUpperCase()] || locationCode;
}
