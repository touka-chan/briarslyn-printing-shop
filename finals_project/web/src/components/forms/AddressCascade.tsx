"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Loader2,
  MapPin,
  Globe,
  Building2,
  Home,
  Hash,
} from "lucide-react";
import type { UserAddress } from "@/types";
import {
  loadRegions,
  loadProvinces,
  loadCities,
  loadBarangays,
  loadZips,
  getProvincesForRegion,
  getCitiesForProvince,
  getBarangaysForCity,
  findZip,
  findRegionByName,
  findProvinceByName,
  findCityByName,
  findBarangayByName,
  type Region,
  type Province,
  type City,
  type Barangay,
} from "@/lib/address";

interface AddressCascadeProps {
  /** Current address (display names) — used to pre-select the cascade. */
  value?: UserAddress | null;
  /** Called whenever the user picks a new region/province/city/barangay/zip. */
  onChange: (next: UserAddress) => void;
  /** Optional className for the surrounding grid. */
  className?: string;
  /** Disable the entire cascade. */
  disabled?: boolean;
}

const inputBase =
  "w-full pl-10 pr-10 py-2.5 text-sm bg-printflow-surface-container rounded-xl border border-printflow-outline-variant/40 focus:bg-printflow-surface focus:border-printflow-primary focus:ring-4 focus:ring-printflow-primary/10 focus:outline-none transition-all placeholder:text-printflow-on-surface-variant/50 disabled:opacity-50 disabled:cursor-not-allowed appearance-none";

const labelCls =
  "text-[12px] font-medium tracking-wide text-printflow-on-surface-variant";

export function AddressCascade({
  value,
  onChange,
  className = "",
  disabled = false,
}: AddressCascadeProps) {
  // --- state --------------------------------------------------------------
  const [regionCode, setRegionCode] = useState<string>("");
  const [provinceCode, setProvinceCode] = useState<string>("");
  const [cityCode, setCityCode] = useState<string>("");
  const [barangayCode, setBarangayCode] = useState<string>("");
  const [zip, setZip] = useState<string>("");

  // Loaded datasets (top-level only — regions, all provinces, all cities,
  // all barangays, all zips). The whole files are small enough except for
  // barangay.json (4.6 MB); we still load it once and keep it cached.
  const [regions, setRegions] = useState<Region[]>([]);
  const [provincesAll, setProvincesAll] = useState<Province[]>([]);
  const [citiesAll, setCitiesAll] = useState<City[]>([]);
  const [barangaysAll, setBarangaysAll] = useState<Barangay[]>([]);

  // Per-level loading flags
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // Reset / re-seed from `value` whenever the address prop changes (e.g.,
  // when the user opens a different row's edit modal).
  const valueKeyRef = useRef<string>("");
  useEffect(() => {
    const v = value ?? {};
    const key = `${v.region ?? ""}|${v.province ?? ""}|${v.city ?? ""}|${v.barangay ?? ""}|${v.zip ?? ""}`;
    if (key === valueKeyRef.current) return;
    valueKeyRef.current = key;
    setRegionCode("");
    setProvinceCode("");
    setCityCode("");
    setBarangayCode("");
    setZip(v.zip ?? "");
  }, [value]);

  // --- lazy dataset loads ------------------------------------------------
  // We always load all regions at mount (it's tiny). Provinces / cities /
  // barangays are loaded on demand the first time the user opens that
  // dropdown. Zips are loaded on demand when a city is selected.
  useEffect(() => {
    let cancelled = false;
    setLoadingRegions(true);
    loadRegions()
      .then((data) => {
        if (cancelled) return;
        setRegions(data);
      })
      .catch(() => {
        if (cancelled) return;
        setRegions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingRegions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureProvincesLoaded = useCallback(async () => {
    if (provincesAll.length > 0) return;
    setLoadingProvinces(true);
    try {
      const data = await loadProvinces();
      setProvincesAll(data);
    } catch {
      setProvincesAll([]);
    } finally {
      setLoadingProvinces(false);
    }
  }, [provincesAll.length]);

  const ensureCitiesLoaded = useCallback(async () => {
    if (citiesAll.length > 0) return;
    setLoadingCities(true);
    try {
      const data = await loadCities();
      setCitiesAll(data);
    } catch {
      setCitiesAll([]);
    } finally {
      setLoadingCities(false);
    }
  }, [citiesAll.length]);

  const ensureBarangaysLoaded = useCallback(async () => {
    if (barangaysAll.length > 0) return;
    setLoadingBarangays(true);
    try {
      const data = await loadBarangays();
      setBarangaysAll(data);
    } catch {
      setBarangaysAll([]);
    } finally {
      setLoadingBarangays(false);
    }
  }, [barangaysAll.length]);

  // When the address prop gives us display names but the codes are unknown,
  // resolve them once (lazy) so the cascade pre-selects the right values.
  useEffect(() => {
    const v = value ?? {};
    if (v.region && !regionCode && regions.length > 0) {
      findRegionByName(v.region).then((r) => {
        if (r) setRegionCode(r.region_code);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions, value]);

  useEffect(() => {
    const v = value ?? {};
    if (v.province && !provinceCode && provincesAll.length > 0 && regionCode) {
      findProvinceByName(v.province, regionCode).then((p) => {
        if (p) setProvinceCode(p.province_code);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provincesAll, regionCode, value]);

  useEffect(() => {
    const v = value ?? {};
    if (v.city && !cityCode && citiesAll.length > 0 && provinceCode) {
      findCityByName(v.city, provinceCode).then((c) => {
        if (c) setCityCode(c.city_code);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citiesAll, provinceCode, value]);

  useEffect(() => {
    const v = value ?? {};
    if (v.barangay && !barangayCode && barangaysAll.length > 0 && cityCode) {
      findBarangayByName(v.barangay, cityCode).then((b) => {
        if (b) setBarangayCode(b.brgy_code);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barangaysAll, cityCode, value]);

  // --- derived options ---------------------------------------------------
  const provinces = useMemo<Province[]>(
    () => (regionCode ? provincesAll.filter((p) => p.region_code === regionCode) : []),
    [provincesAll, regionCode],
  );
  const cities = useMemo<City[]>(
    () => (provinceCode ? citiesAll.filter((c) => c.province_code === provinceCode) : []),
    [citiesAll, provinceCode],
  );
  const barangays = useMemo<Barangay[]>(
    () => (cityCode ? barangaysAll.filter((b) => b.city_code === cityCode) : []),
    [barangaysAll, cityCode],
  );

  // --- handlers ----------------------------------------------------------
  const emit = useCallback(
    (patch: Partial<UserAddress>) => {
      const current = value ?? {};
      onChange({ ...current, ...patch });
    },
    [value, onChange],
  );

  const onRegionChange = (next: string) => {
    setRegionCode(next);
    setProvinceCode("");
    setCityCode("");
    setBarangayCode("");
    const region = regions.find((r) => r.region_code === next);
    emit({ region: region?.region_name });
  };

  const onProvinceChange = (next: string) => {
    setProvinceCode(next);
    setCityCode("");
    setBarangayCode("");
    const province = provincesAll.find((p) => p.province_code === next);
    emit({ province: province?.province_name });
  };

  const onCityChange = async (next: string) => {
    setCityCode(next);
    setBarangayCode("");
    const city = citiesAll.find((c) => c.city_code === next);
    const province = provincesAll.find((p) => p.province_code === provinceCode);
    let nextZip = "";
    if (city && province) {
      try {
        nextZip = (await findZip(city.city_name, province.province_name)) ?? "";
      } catch {
        nextZip = "";
      }
    }
    setZip(nextZip);
    emit({ city: city?.city_name, zip: nextZip });
  };

  const onBarangayChange = (next: string) => {
    setBarangayCode(next);
    const barangay = barangaysAll.find((b) => b.brgy_code === next);
    emit({ barangay: barangay?.brgy_name });
  };

  const onZipChange = (next: string) => {
    setZip(next);
    emit({ zip: next });
  };

  // --- render ------------------------------------------------------------
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
      {/* Region */}
      <div>
        <label className={labelCls}>Region</label>
        <div className="relative mt-1.5">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          {loadingRegions ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant animate-spin" />
          ) : (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          )}
          <select
            value={regionCode}
            onChange={(e) => onRegionChange(e.target.value)}
            onFocus={ensureProvincesLoaded}
            disabled={disabled || loadingRegions}
            className={inputBase}
          >
            <option value="">Select a region</option>
            {regions.map((r) => (
              <option key={r.region_code} value={r.region_code}>
                {r.region_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Province */}
      <div>
        <label className={labelCls}>Province</label>
        <div className="relative mt-1.5">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          {loadingProvinces ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant animate-spin" />
          ) : (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          )}
          <select
            value={provinceCode}
            onChange={(e) => onProvinceChange(e.target.value)}
            onFocus={ensureProvincesLoaded}
            disabled={disabled || !regionCode || loadingProvinces}
            className={inputBase}
          >
            <option value="">{regionCode ? "Select a province" : "Select a region first"}</option>
            {provinces.map((p) => (
              <option key={p.province_code} value={p.province_code}>
                {p.province_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* City */}
      <div>
        <label className={labelCls}>City / Municipality</label>
        <div className="relative mt-1.5">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          {loadingCities ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant animate-spin" />
          ) : (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          )}
          <select
            value={cityCode}
            onChange={(e) => onCityChange(e.target.value)}
            onFocus={ensureCitiesLoaded}
            disabled={disabled || !provinceCode || loadingCities}
            className={inputBase}
          >
            <option value="">{provinceCode ? "Select a city" : "Select a province first"}</option>
            {cities.map((c) => (
              <option key={c.city_code} value={c.city_code}>
                {c.city_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Barangay */}
      <div>
        <label className={labelCls}>Barangay</label>
        <div className="relative mt-1.5">
          <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          {loadingBarangays ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant animate-spin" />
          ) : (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          )}
          <select
            value={barangayCode}
            onChange={(e) => onBarangayChange(e.target.value)}
            onFocus={ensureBarangaysLoaded}
            disabled={disabled || !cityCode || loadingBarangays}
            className={inputBase}
          >
            <option value="">{cityCode ? "Select a barangay" : "Select a city first"}</option>
            {barangays.map((b) => (
              <option key={b.brgy_code} value={b.brgy_code}>
                {b.brgy_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Zip — full width so it sits under barangay in the 2-col grid. */}
      <div className="sm:col-span-2">
        <label className={labelCls}>ZIP code</label>
        <div className="relative mt-1.5">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 4009"
            value={zip}
            onChange={(e) => onZipChange(e.target.value)}
            disabled={disabled}
            className={`${inputBase} pr-10`}
          />
        </div>
        <p className="text-[11px] text-printflow-on-surface-variant mt-1.5">
          Auto-suggested from the selected city. Edit if needed.
        </p>
      </div>
    </div>
  );
}

export default AddressCascade;
