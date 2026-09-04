import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

/// Lightweight loader for the bundled PSGC (Philippine Standard Geographic
/// Code) JSON files. Mirrors the runtime-fetch design from
/// `web/src/lib/address.ts` — the data is loaded lazily on first read, then
/// cached in module-level fields so subsequent calls are synchronous.
///
/// `barangay.json` is ~4.6 MB so we only load it the first time the user
/// opens the barangay dropdown. Region / province / city are loaded
/// eagerly when the cascade mounts because they're tiny.
class AddressService {
  AddressService._();

  // Cached datasets.
  static List<AddressRegion>? _regions;
  static List<AddressProvince>? _provinces;
  static List<AddressCity>? _cities;
  static List<AddressBarangay>? _barangays;
  static List<AddressZipEntry>? _zips;

  // In-flight loaders so a concurrent mount dedupes into a single load.
  static Future<List<AddressRegion>>? _regionsLoad;
  static Future<List<AddressProvince>>? _provincesLoad;
  static Future<List<AddressCity>>? _citiesLoad;
  static Future<List<AddressBarangay>>? _barangaysLoad;
  static Future<List<AddressZipEntry>>? _zipsLoad;

  // ── Public API ────────────────────────────────────────────────────────

  /// Returns all 17 PH regions. Tiny — loaded once and cached.
  static Future<List<AddressRegion>> loadRegions() {
    if (_regions != null) return Future.value(_regions);
    return _regionsLoad ??= _loadRegions().then((data) {
      _regions = data;
      return data;
    });
  }

  /// Returns all ~80 provinces. Lazy — only loaded when the user focuses
  /// the province dropdown.
  static Future<List<AddressProvince>> loadProvinces() {
    if (_provinces != null) return Future.value(_provinces);
    return _provincesLoad ??= _loadProvinces().then((data) {
      _provinces = data;
      return data;
    });
  }

  /// Returns all ~1,600 cities / municipalities. Lazy.
  static Future<List<AddressCity>> loadCities() {
    if (_cities != null) return Future.value(_cities);
    return _citiesLoad ??= _loadCities().then((data) {
      _cities = data;
      return data;
    });
  }

  /// Returns all ~42,000 barangays (4.6 MB). Lazy — only loaded when the
  /// user focuses the barangay dropdown.
  static Future<List<AddressBarangay>> loadBarangays() {
    if (_barangays != null) return Future.value(_barangays);
    return _barangaysLoad ??= _loadBarangays().then((data) {
      _barangays = data;
      return data;
    });
  }

  /// Returns the free-text `area → zip` lookup. Lazy.
  static Future<List<AddressZipEntry>> loadZips() {
    if (_zips != null) return Future.value(_zips);
    return _zipsLoad ??= _loadZips().then((data) {
      _zips = data;
      return data;
    });
  }

  // ── Lookups (sync after the relevant dataset is loaded) ───────────────

  static AddressRegion? findRegionByName(String name) {
    final regions = _regions;
    if (regions == null) return null;
    final needle = name.trim().toLowerCase();
    for (final r in regions) {
      if (r.regionName.toLowerCase() == needle) return r;
    }
    return null;
  }

  static AddressProvince? findProvinceByName(String name, String regionCode) {
    final provinces = _provinces;
    if (provinces == null) return null;
    final needle = name.trim().toLowerCase();
    for (final p in provinces) {
      if (p.regionCode == regionCode && p.provinceName.toLowerCase() == needle) {
        return p;
      }
    }
    return null;
  }

  static AddressCity? findCityByName(String name, String provinceCode) {
    final cities = _cities;
    if (cities == null) return null;
    final needle = name.trim().toLowerCase();
    for (final c in cities) {
      if (c.provinceCode == provinceCode && c.cityName.toLowerCase() == needle) {
        return c;
      }
    }
    return null;
  }

  static AddressBarangay? findBarangayByName(String name, String cityCode) {
    final barangays = _barangays;
    if (barangays == null) return null;
    final needle = name.trim().toLowerCase();
    for (final b in barangays) {
      if (b.cityCode == cityCode && b.brgyName.toLowerCase() == needle) {
        return b;
      }
    }
    return null;
  }

  /// Looks up the zip for a city. The bundled zip data is keyed by free
  /// text in the form `PH - Province CityName` (e.g. `PH - Laguna Sta.
  /// Cruz`), so we match the city name (case-insensitive) and prefer an
  /// exact-province match when multiple rows share a city name.
  static String? findZip(String cityName, String? provinceName) {
    final zips = _zips;
    if (zips == null) return null;
    final needle = cityName.trim().toLowerCase();
    String? loose;
    for (final z in zips) {
      final area = z.area.toLowerCase();
      // The dataset's "area" always ends with the city name. Match the
      // tail so "Sta. Cruz" doesn't also match "Sta. Cruz (Capital)".
      if (area.endsWith(needle) || area.contains(' $needle')) {
        if (provinceName != null &&
            area.contains(provinceName.trim().toLowerCase())) {
          return z.zip;
        }
        loose ??= z.zip;
      }
    }
    return loose;
  }

  // ── Loaders ──────────────────────────────────────────────────────────

  static Future<List<AddressRegion>> _loadRegions() async {
    final raw = await rootBundle.loadString('assets/address/region.json');
    return (jsonDecode(raw) as List)
        .map((j) => AddressRegion(
              regionCode: (j['region_code'] ?? '') as String,
              regionName: (j['region_name'] ?? '') as String,
            ))
        .toList(growable: false);
  }

  static Future<List<AddressProvince>> _loadProvinces() async {
    final raw = await rootBundle.loadString('assets/address/province.json');
    return (jsonDecode(raw) as List)
        .map((j) => AddressProvince(
              provinceCode: (j['province_code'] ?? '') as String,
              provinceName: (j['province_name'] ?? '') as String,
              regionCode: (j['region_code'] ?? '') as String,
            ))
        .toList(growable: false);
  }

  static Future<List<AddressCity>> _loadCities() async {
    final raw = await rootBundle.loadString('assets/address/city.json');
    return (jsonDecode(raw) as List)
        .map((j) => AddressCity(
              cityCode: (j['city_code'] ?? '') as String,
              cityName: (j['city_name'] ?? '') as String,
              provinceCode: (j['province_code'] ?? '') as String,
            ))
        .toList(growable: false);
  }

  static Future<List<AddressBarangay>> _loadBarangays() async {
    final raw = await rootBundle.loadString('assets/address/barangay.json');
    return (jsonDecode(raw) as List)
        .map((j) => AddressBarangay(
              brgyCode: (j['brgy_code'] ?? '') as String,
              brgyName: (j['brgy_name'] ?? '') as String,
              cityCode: (j['city_code'] ?? '') as String,
            ))
        .toList(growable: false);
  }

  static Future<List<AddressZipEntry>> _loadZips() async {
    final raw = await rootBundle.loadString('assets/address/ph-zip-codes.json');
    return (jsonDecode(raw) as List)
        .map((j) => AddressZipEntry(
              area: (j['area'] ?? '') as String,
              zip: (j['zip'] ?? '') as String,
            ))
        .toList(growable: false);
  }
}

// ── Data classes (public so the cascade widget can read them) ──────────

class AddressRegion {
  const AddressRegion({required this.regionCode, required this.regionName});
  final String regionCode;
  final String regionName;
}

class AddressProvince {
  const AddressProvince({
    required this.provinceCode,
    required this.provinceName,
    required this.regionCode,
  });
  final String provinceCode;
  final String provinceName;
  final String regionCode;
}

class AddressCity {
  const AddressCity({
    required this.cityCode,
    required this.cityName,
    required this.provinceCode,
  });
  final String cityCode;
  final String cityName;
  final String provinceCode;
}

class AddressBarangay {
  const AddressBarangay({
    required this.brgyCode,
    required this.brgyName,
    required this.cityCode,
  });
  final String brgyCode;
  final String brgyName;
  final String cityCode;
}

class AddressZipEntry {
  const AddressZipEntry({required this.area, required this.zip});
  final String area;
  final String zip;
}
