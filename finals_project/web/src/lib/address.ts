// Address data loader — fetches the PSGC (Philippine Standard Geographic
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

export type ZipEntry = {
  area: string;
  zip: string;
};

const BASE = "/Address";

let _regions: Region[] | null = null;
let _regionsPromise: Promise<Region[]> | null = null;
let _provinces: Province[] | null = null;
let _provincesPromise: Promise<Province[]> | null = null;
let _cities: City[] | null = null;
let _citiesPromise: Promise<City[]> | null = null;
let _barangays: Barangay[] | null = null;
let _barangaysPromise: Promise<Barangay[]> | null = null;
let _zips: ZipEntry[] | null = null;
let _zipsPromise: Promise<ZipEntry[]> | null = null;

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "force-cache" });
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

export async function loadZips(): Promise<ZipEntry[]> {
  if (_zips) return _zips;
  if (!_zipsPromise) {
    _zipsPromise = fetchJSON<ZipEntry[]>(`${BASE}/ph-zip-codes.json`)
      .then((data) => {
        _zips = data;
        return data;
      })
      .catch((err) => {
        _zipsPromise = null;
        throw err;
      });
  }
  return _zipsPromise;
}

// Filter helpers — pre-filter the cached list to the selected parent so the
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

// Best-effort zip lookup: the ph-zip-codes.json has free-text "area" strings
// like "PH - Laguna Sta. Cruz" so we match the city name (case-insensitive)
// and prefer entries that also include the province. Returns the first match
// or null if nothing fits.
export async function findZip(
  cityName: string,
  provinceName: string,
): Promise<string | null> {
  const all = await loadZips();
  const cn = cityName.trim().toLowerCase();
  const pn = provinceName.trim().toLowerCase();
  // Prefer exact province + city match.
  const exact = all.find((z) => {
    const a = z.area.toLowerCase();
    return a.includes(pn) && a.includes(cn);
  });
  if (exact) return exact.zip;
  // Fall back to city-only match.
  const fuzzy = all.find((z) => z.area.toLowerCase().includes(cn));
  return fuzzy ? fuzzy.zip : null;
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
