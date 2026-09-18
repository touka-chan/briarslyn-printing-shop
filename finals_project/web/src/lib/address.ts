// Address data loader - fetches the PSGC (Philippine Standard Geographic
// Code) JSON files from /public/Address at runtime. The files are not
// imported into the bundle to keep the client small: barangay.json is 4.6 MB.
//
// All fetches are cached in module-level variables so multiple forms in the
// same session don't re-fetch the same data. Each fetch returns a defensive
// copy so callers can mutate freely.

export type Region = {
  id: number;
  psgc_code: string;
  region_name: string;
  region_code: string;
};

export type Province = {
  province_code: string;
  province_name: string;
  psgc_code: string;
  region_code: string;
};

export type City = {
  city_code: string;
  city_name: string;
  province_code: string;
  psgc_code: string;
  region_desc: string;
};

export type Barangay = {
  brgy_code: string;
  brgy_name: string;
  city_code: string;
  province_code: string;
  region_code: string;
};

// city_zip_map.json is a flat object keyed by PSGC city code, with the
// Philippine zip code as the value (e.g. { "140101": "2800", ... }).
// This is the authoritative source for the zip auto-fill - the old
// ph-zip-codes.json used free-text "area" strings that didn't match
// the city code returned by city.json, so the lookup was unreliable.
export type CityZipMap = Record<string, string>;

const BASE = "/Address";

let _regions: Region[] | null = null;
let _regionsPromise: Promise<Region[]> | null = null;
let _provinces: Province[] | null = null;
let _provincesPromise: Promise<Province[]> | null = null;
let _cities: City[] | null = null;
let _citiesPromise: Promise<City[]> | null = null;
let _barangays: Barangay[] | null = null;
let _barangaysPromise: Promise<Barangay[]> | null = null;
let _cityZips: CityZipMap | null = null;
let _cityZipsPromise: Promise<CityZipMap> | null = null;

async function fetchJSON<T>(path: string): Promise<T> {
  // Use a build-time cache buster so a fresh deploy always re-fetches
  // the JSON (and never serves a stale 404 from a previous build's
  // browser cache). `cache: "default"` lets the browser reuse the
  // response within a session but respects server cache headers on
  // revalidation.
  const buildId =
    (typeof process !== "undefined" && (process as { env?: { NEXT_PUBLIC_BUILD_ID?: string } }).env?.NEXT_PUBLIC_BUILD_ID) ||
    (typeof globalThis !== "undefined" &&
      (globalThis as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__?.buildId) ||
    "dev";
  const url = `${path}?v=${encodeURIComponent(buildId)}`;
  const res = await fetch(url, { cache: "default" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function loadRegions(): Promise<Region[]> {
  if (_regions) return _regions;
  if (!_regionsPromise) {
    _regionsPromise = fetchJSON<Region[]>(`${BASE}/region.json`)
      .then((data) => {
        _regions = data;
        return data;
      })
      .catch((err) => {
        _regionsPromise = null;
        throw err;
      });
  }
  return _regionsPromise;
}

export async function loadProvinces(): Promise<Province[]> {
  if (_provinces) return _provinces;
  if (!_provincesPromise) {
    _provincesPromise = fetchJSON<Province[]>(`${BASE}/province.json`)
      .then((data) => {
        _provinces = data;
        return data;
      })
      .catch((err) => {
        _provincesPromise = null;
        throw err;
      });
  }
  return _provincesPromise;
}

export async function loadCities(): Promise<City[]> {
  if (_cities) return _cities;
  if (!_citiesPromise) {
    _citiesPromise = fetchJSON<City[]>(`${BASE}/city.json`)
      .then((data) => {
        _cities = data;
        return data;
      })
      .catch((err) => {
        _citiesPromise = null;
        throw err;
      });
  }
  return _citiesPromise;
}

export async function loadBarangays(): Promise<Barangay[]> {
  if (_barangays) return _barangays;
  if (!_barangaysPromise) {
    _barangaysPromise = fetchJSON<Barangay[]>(`${BASE}/barangay.json`)
      .then((data) => {
        _barangays = data;
        return data;
      })
      .catch((err) => {
        _barangaysPromise = null;
        throw err;
      });
  }
  return _barangaysPromise;
}

export async function loadCityZipMap(): Promise<CityZipMap> {
  if (_cityZips) return _cityZips;
  if (!_cityZipsPromise) {
    _cityZipsPromise = fetchJSON<CityZipMap>(`${BASE}/city_zip_map.json`)
      .then((data) => {
        _cityZips = data;
        return data;
      })
      .catch((err) => {
        _cityZipsPromise = null;
        throw err;
      });
  }
  return _cityZipsPromise;
}

// Filter helpers - pre-filter the cached list to the selected parent so the
// dropdown options stay small (e.g., only show provinces for the selected
// region). Returns a fresh array so callers can sort/mutate without leaking
// into the cache.

export async function getProvincesForRegion(
  regionCode: string,
): Promise<Province[]> {
  const all = await loadProvinces();
  return all.filter((p) => p.region_code === regionCode);
}

export async function getCitiesForProvince(
  provinceCode: string,
): Promise<City[]> {
  const all = await loadCities();
  return all.filter((c) => c.province_code === provinceCode);
}

export async function getBarangaysForCity(
  cityCode: string,
): Promise<Barangay[]> {
  const all = await loadBarangays();
  return all.filter((b) => b.city_code === cityCode);
}

// Direct zip lookup by PSGC city code. city_zip_map.json is keyed by the
// same `city_code` value that city.json returns (e.g. "140101"), so the
// lookup is unambiguous and doesn't need name-based fuzzy matching.
export async function findZipByCode(
  cityCode: string,
): Promise<string | null> {
  if (!cityCode) return null;
  const map = await loadCityZipMap();
  return map[cityCode] ?? null;
}

// Backwards-compatible name-based lookup. Prefer findZipByCode when the
// city_code is available (which it is in AddressCascade), but keep this
// for any caller that still passes names.
export async function findZip(
  cityName: string,
  provinceName?: string,
): Promise<string | null> {
  const map = await loadCityZipMap();
  const cn = cityName.trim().toLowerCase();
  // The map is keyed by PSGC code, so we need to find the city whose name
  // (case-insensitive) matches. For callers that have a city_code, use
  // findZipByCode instead - it's exact and cheaper.
  const cities = await loadCities();
  const match = cities.find((c) => c.city_name.toLowerCase() === cn);
  if (match) return map[match.city_code] ?? null;
  return null;
}

// Lookup by display name (used when seeding the cascade with a User's existing
// address values, which we store as display names, not codes).
export async function findRegionByName(name: string): Promise<Region | null> {
  const all = await loadRegions();
  return all.find((r) => r.region_name === name) ?? null;
}

export async function findProvinceByName(
  name: string,
  regionCode?: string,
): Promise<Province | null> {
  const all = await loadProvinces();
  const matches = all.filter((p) => p.province_name === name);
  if (regionCode) {
    return matches.find((p) => p.region_code === regionCode) ?? null;
  }
  return matches[0] ?? null;
}

export async function findCityByName(
  name: string,
  provinceCode?: string,
): Promise<City | null> {
  const all = await loadCities();
  const matches = all.filter((c) => c.city_name === name);
  if (provinceCode) {
    return matches.find((c) => c.province_code === provinceCode) ?? null;
  }
  return matches[0] ?? null;
}

export async function findBarangayByName(
  name: string,
  cityCode?: string,
): Promise<Barangay | null> {
  const all = await loadBarangays();
  const matches = all.filter((b) => b.brgy_name === name);
  if (cityCode) {
    return matches.find((b) => b.city_code === cityCode) ?? null;
  }
  return matches[0] ?? null;
}
