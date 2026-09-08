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
  findZipByCode,
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

/**
 * Address cascade for the Philippine address hierarchy
 * (region → province → city → barangay → zip).
 *
 * The component is fully controlled: every selection is reported back to
 * the parent via `onChange`, and the parent passes the canonical address
 * back in via `value`. Whenever `value` changes (e.g. the parent opens a
 * different row's edit modal) the cascade re-resolves the full chain in
 * a single async pass and re-derives the zip from the city code, so the
 * form always shows the correct selection — including when switching
 * between two rows.
 */
export function AddressCascade({
  value,
  onChange,
  className = "",
  disabled = false,
}: AddressCascadeProps) {
  // --- state --------------------------------------------------------------
  // The codes are the source of truth for the <select> values. The parent
  // only knows display names, so we resolve names → codes on every change
  // of `value` (see the resolver effect below).
  const [regionCode, setRegionCode] = useState<string>("");
  const [provinceCode, setProvinceCode] = useState<string>("");
  const [cityCode, setCityCode] = useState<string>("");
  const [barangayCode, setBarangayCode] = useState<string>("");
  const [zip, setZip] = useState<string>("");

  // Loaded datasets (regions, all provinces, all cities, all barangays,
  // all zips). The whole files are small except for barangay.json (4.6 MB);
  // we still load each once and keep it cached for the session.
  const [regions, setRegions] = useState<Region[]>([]);
  const [provincesAll, setProvincesAll] = useState<Province[]>([]);
  const [citiesAll, setCitiesAll] = useState<City[]>([]);
  const [barangaysAll, setBarangaysAll] = useState<Barangay[]>([]);

  // Per-level loading flags
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // Eagerly load all four datasets on mount so the resolver effect can
  // run as soon as `value` arrives (instead of waiting for the user to
  // focus a dropdown). This is the timing fix for the "form doesn't
  // update when I click a different row" bug.
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

  useEffect(() => {
    let cancelled = false;
    setLoadingProvinces(true);
    loadProvinces()
      .then((data) => {
        if (cancelled) return;
        setProvincesAll(data);
      })
      .catch(() => {
        if (cancelled) return;
        setProvincesAll([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingProvinces(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingCities(true);
    loadCities()
      .then((data) => {
        if (cancelled) return;
        setCitiesAll(data);
      })
      .catch(() => {
        if (cancelled) return;
        setCitiesAll([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingBarangays(true);
    loadBarangays()
      .then((data) => {
        if (cancelled) return;
        setBarangaysAll(data);
      })
      .catch(() => {
        if (cancelled) return;
        setBarangaysAll([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingBarangays(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- resolver -----------------------------------------------------------
  // Single async resolver. Re-runs whenever `value` changes OR any
  // dataset finally loads. Resolves region → province → city → barangay
  // in sequence, and re-derives the zip from the resolved city code
  // (the value's stored zip is overridden — the city_zip_map is the
  // authoritative source keyed by city_code, not by name).
  //
  // This replaces the four separate resolver effects which were racy:
  // each one only fired when its sibling state updated, so on a fresh
  // edit the order would be wrong and the selections would land on
  // stale data.
  const lastValueKeyRef = useRef<string>("");
  useEffect(() => {
    const v = value ?? {};
    // Key off the canonical display names only. The zip is intentionally
    // not in the key — we re-derive it from the city code every time,
    // so a stale or wrong zip in the database gets corrected on every
    // open. The `__` reset is so an empty address still re-runs.
    const key = `${v.region ?? ""}|${v.province ?? ""}|${v.city ?? ""}|${v.barangay ?? ""}`;
    // If the parent's value object is a fresh reference but the key
    // matches the last one, skip — but allow explicit resets (empty
    // value when we previously had content).
    const hadContent = !!lastValueKeyRef.current;
    const hasContent = !!key;
    if (key === lastValueKeyRef.current) return;
    if (!hasContent && !hadContent) return;
    lastValueKeyRef.current = key;

    let cancelled = false;
    const run = async () => {
      // Region first (no parent dependency).
      let resolvedRegionCode = "";
      if (v.region) {
        const r = await findRegionByName(v.region);
        if (cancelled) return;
        if (r) resolvedRegionCode = r.region_code;
      }
      setRegionCode(resolvedRegionCode);

      // Province — needs the resolved region code to disambiguate.
      let resolvedProvinceCode = "";
      if (v.region && resolvedRegionCode) {
        const p = await findProvinceByName(v.province ?? "", resolvedRegionCode);
        if (cancelled) return;
        if (p) resolvedProvinceCode = p.province_code;
      }
      setProvinceCode(resolvedProvinceCode);

      // City — needs the resolved province code to disambiguate.
      let resolvedCityCode = "";
      let derivedZip = "";
      if (v.region && v.province && v.city && resolvedProvinceCode) {
        const c = await findCityByName(v.city, resolvedProvinceCode);
        if (cancelled) return;
        if (c) {
          resolvedCityCode = c.city_code;
          // Re-derive the zip from the city code. The value's stored
          // zip is intentionally overridden — the city_zip_map is the
          // authoritative source and is keyed by city_code, not name.
          try {
            derivedZip = (await findZipByCode(c.city_code)) ?? "";
          } catch {
            derivedZip = "";
          }
        }
      }
      setCityCode(resolvedCityCode);
      // If we resolved a city, use the derived zip; otherwise preserve
      // whatever the user already had (typed or stored).
      setZip(resolvedCityCode ? derivedZip : v.zip ?? "");

      // Barangay — needs the resolved city code.
      let resolvedBarangayCode = "";
      if (v.region && v.province && v.city && v.barangay && resolvedCityCode) {
        const b = await findBarangayByName(v.barangay, resolvedCityCode);
        if (cancelled) return;
        if (b) resolvedBarangayCode = b.brgy_code;
      }
      setBarangayCode(resolvedBarangayCode);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    value,
    // Re-run if any dataset finally loads so a deferred address can
    // still resolve. The key guard above prevents wasted work when
    // value hasn't changed.
    regions,
    provincesAll,
    citiesAll,
    barangaysAll,
  ]);

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
    // Reset downstream fields in the value so a stale province/city
    // doesn't survive the region change.
    emit({
      region: region?.region_name,
      province: undefined,
      city: undefined,
      barangay: undefined,
    });
  };

  const onProvinceChange = (next: string) => {
    setProvinceCode(next);
    setCityCode("");
    setBarangayCode("");
    const province = provincesAll.find((p) => p.province_code === next);
    emit({
      province: province?.province_name,
      city: undefined,
      barangay: undefined,
    });
  };

  const onCityChange = async (next: string) => {
    setCityCode(next);
    setBarangayCode("");
    const city = citiesAll.find((c) => c.city_code === next);
    // Always re-derive the zip from the city code. This is the single
    // source of truth — never trust a stored zip once we know the city.
    let nextZip = "";
    if (city) {
      try {
        nextZip = (await findZipByCode(city.city_code)) ?? "";
      } catch {
        nextZip = "";
      }
    }
    setZip(nextZip);
    emit({
      city: city?.city_name,
      zip: nextZip,
      barangay: undefined,
    });
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
