// PrintFlow Mobile - PSGC address reference data.
//
// Mirrors `web/public/Address/*.json` (same files, same schemas) so the
// cashier AddressCascade offers identical region - province - city -
// barangay dropdowns on both platforms. ZIPs come from city_zip_map
// keyed by city code - the single source of truth, like the web.
//
// Loaded once and cached for the app lifetime. Barangay rows (~42k)
// parse in a single pass at first use.
import 'dart:convert';

import 'package:flutter/services.dart';

/// One named PSGC entry with its code.
class AddressEntry {
  final String code;
  final String name;

  const AddressEntry({required this.code, required this.name});
}

class AddressData {
  final List<AddressEntry> regions;
  final Map<String, List<AddressEntry>> provincesByRegion;
  final Map<String, List<AddressEntry>> citiesByProvince;
  final Map<String, List<AddressEntry>> barangaysByCity;
  final Map<String, String> zipByCity;

  const AddressData._({
    required this.regions,
    required this.provincesByRegion,
    required this.citiesByProvince,
    required this.barangaysByCity,
    required this.zipByCity,
  });

  static AddressData? _cache;

  /// Loads (or returns the cached) reference data.
  static Future<AddressData> load() async {
    final cached = _cache;
    if (cached != null) return cached;
    final regionsRaw =
        jsonDecode(await rootBundle.loadString('assets/address/region.json'))
            as List;
    final provincesRaw = jsonDecode(
        await rootBundle.loadString('assets/address/province.json')) as List;
    final citiesRaw = jsonDecode(
        await rootBundle.loadString('assets/address/city.json')) as List;
    final zipRaw = jsonDecode(await rootBundle
        .loadString('assets/address/city_zip_map.json')) as Map<String, dynamic>;
    final barangaysRaw = jsonDecode(await rootBundle
        .loadString('assets/address/barangay.json')) as List;

    final regions = regionsRaw
        .map((e) => AddressEntry(
              code: '${e['region_code']}',
              name: '${e['region_name']}',
            ))
        .toList();
    final provincesByRegion = <String, List<AddressEntry>>{};
    for (final e in provincesRaw) {
      final entry = AddressEntry(
        code: '${e['province_code']}',
        name: '${e['province_name']}',
      );
      provincesByRegion.putIfAbsent('${e['region_code']}', () => []).add(entry);
    }
    final citiesByProvince = <String, List<AddressEntry>>{};
    for (final e in citiesRaw) {
      final entry = AddressEntry(
        code: '${e['city_code']}',
        name: '${e['city_name']}',
      );
      citiesByProvince
          .putIfAbsent('${e['province_code']}', () => [])
          .add(entry);
    }
    final barangaysByCity = <String, List<AddressEntry>>{};
    for (final e in barangaysRaw) {
      final entry = AddressEntry(
        code: '${e['brgy_code']}',
        name: '${e['brgy_name']}',
      );
      barangaysByCity.putIfAbsent('${e['city_code']}', () => []).add(entry);
    }
    final zipByCity = <String, String>{
      for (final kv in zipRaw.entries) kv.key.toString(): '${kv.value}',
    };
    final data = AddressData._(
      regions: regions,
      provincesByRegion: provincesByRegion,
      citiesByProvince: citiesByProvince,
      barangaysByCity: barangaysByCity,
      zipByCity: zipByCity,
    );
    _cache = data;
    return data;
  }

  String? zipForCity(String cityCode) => zipByCity[cityCode];
}
