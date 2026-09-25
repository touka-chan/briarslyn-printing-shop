import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../models/user_address.dart';
import '../services/address_data.dart';
import '../theme/app_theme.dart';

/// Customer address picker for the Cashier New Order screen.
///
/// Cascading dropdowns Region - Province - City - Barangay backed by the
/// bundled PSGC reference data (same files as the web cascade), with the
/// ZIP auto-derived from the city code. All levels are optional - an
/// untouched cascade emits `const UserAddress()` so the order can still
/// be created without an address.
///
/// The parent owns [value]; picking a higher level clears the levels
/// below it (mirrors the web cascade). External [value] changes (e.g.
/// hydrating from the existing-customer picker) re-sync the dropdowns.
class AddressCascade extends StatefulWidget {
  const AddressCascade({
    super.key,
    required this.value,
    required this.onChange,
  });

  final UserAddress value;
  final ValueChanged<UserAddress> onChange;

  @override
  State<AddressCascade> createState() => _AddressCascadeState();
}

class _AddressCascadeState extends State<AddressCascade> {
  late Future<AddressData> _dataFuture;

  String? _regionCode;
  String? _provinceCode;
  String? _cityCode;
  String? _barangayCode;
  bool _synced = false;

  @override
  void initState() {
    super.initState();
    _dataFuture = AddressData.load();
  }

  @override
  void didUpdateWidget(AddressCascade oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value.region != widget.value.region ||
        oldWidget.value.province != widget.value.province ||
        oldWidget.value.city != widget.value.city ||
        oldWidget.value.barangay != widget.value.barangay ||
        oldWidget.value.zip != widget.value.zip) {
      // External value changed - re-sync on next data arrival.
      _synced = false;
    }
  }

  String? _codeFor(List<AddressEntry> entries, String? name) {
    if (name == null || name.isEmpty) return null;
    for (final e in entries) {
      if (e.name == name) return e.code;
    }
    return null;
  }

  String? _nameFor(List<AddressEntry> entries, String? code) {
    if (code == null) return null;
    for (final e in entries) {
      if (e.code == code) return e.name;
    }
    return null;
  }

  void _syncFromValue(AddressData data) {
    final regionCode = _codeFor(data.regions, widget.value.region);
    final provinceCode = _codeFor(
        regionCode == null ? const [] : (data.provincesByRegion[regionCode] ?? const []),
        widget.value.province);
    final cityCode = _codeFor(
        provinceCode == null ? const [] : (data.citiesByProvince[provinceCode] ?? const []),
        widget.value.city);
    final barangayCode = _codeFor(
        cityCode == null ? const [] : (data.barangaysByCity[cityCode] ?? const []),
        widget.value.barangay);
    setState(() {
      _regionCode = regionCode;
      _provinceCode = provinceCode;
      _cityCode = cityCode;
      _barangayCode = barangayCode;
      _synced = true;
    });
  }

  List<AddressEntry> _barangayOptions(AddressData data) {
    if (_cityCode == null) return const <AddressEntry>[];
    return data.barangaysByCity[_cityCode] ?? const <AddressEntry>[];
  }

  void _emit(AddressData data) {
    widget.onChange(UserAddress(
      region: _nameFor(data.regions, _regionCode),
      province: _nameFor(
          _regionCode == null ? const [] : (data.provincesByRegion[_regionCode] ?? const []),
          _provinceCode),
      city: _nameFor(
          _provinceCode == null ? const [] : (data.citiesByProvince[_provinceCode] ?? const []),
          _cityCode),
      barangay: _nameFor(_barangayOptions(data), _barangayCode),
      zip: _cityCode == null ? null : data.zipForCity(_cityCode!),
    ));
  }

  InputDecoration _decoration(String hint, IconData icon) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, color: AppTheme.onSurfaceVariant),
      filled: true,
      fillColor: AppTheme.surfaceContainer,
      border: OutlineInputBorder(
        borderRadius: AppRadius.rMd,
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
    );
  }

  Widget _dropdown({
    required String label,
    required String? value,
    required List<AddressEntry> options,
    required ValueChanged<String?> onChanged,
    required IconData icon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: AppTheme.onSurface,
              ),
        ),
        const SizedBox(height: AppSpacing.sm),
          DropdownButtonFormField<String>(
            // Keyed by selection: `value` is deprecated on form fields,
            // so the field is rebuilt fresh (with initialValue) whenever
            // the selection changes - parent hydration and cascade
            // resets included. Codes always come from `options` (or
            // null), so the exactly-one-item assertion always holds.
            key: ValueKey('$label-$value'),
            initialValue: value,
          decoration: _decoration('Select $label'.toLowerCase(), icon),
          items: options
              .map((e) => DropdownMenuItem(value: e.code, child: Text(e.name)))
              .toList(),
          onChanged: onChanged,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<AddressData>(
      future: _dataFuture,
      builder: (context, snap) {
        if (snap.hasError) {
          return const Text(
            'Address list unavailable - you can still create the order without an address.',
          );
        }
        if (!snap.hasData) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: CircularProgressIndicator(),
            ),
          );
        }
        final data = snap.data!;
        if (!_synced) {
          // Defer to after build to avoid setState during build.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _syncFromValue(data);
          });
        }
        final provinces = _regionCode == null
            ? const <AddressEntry>[]
            : (data.provincesByRegion[_regionCode] ?? const <AddressEntry>[]);
        final cities = _provinceCode == null
            ? const <AddressEntry>[]
            : (data.citiesByProvince[_provinceCode] ?? const <AddressEntry>[]);
        final barangays = _cityCode == null
            ? const <AddressEntry>[]
            : (data.barangaysByCity[_cityCode] ?? const <AddressEntry>[]);
        final zip = _cityCode == null ? null : data.zipForCity(_cityCode!);

        return Column(
          children: [
            _dropdown(
              label: 'Region',
              value: _regionCode,
              options: data.regions,
              icon: Icons.public_outlined,
              onChanged: (v) => setState(() {
                _regionCode = v;
                _provinceCode = null;
                _cityCode = null;
                _barangayCode = null;
                _emit(data);
              }),
            ),
            const SizedBox(height: AppSpacing.md),
            _dropdown(
              label: 'Province',
              value: _provinceCode,
              options: provinces,
              icon: Icons.map_outlined,
              onChanged: (v) => setState(() {
                _provinceCode = v;
                _cityCode = null;
                _barangayCode = null;
                _emit(data);
              }),
            ),
            const SizedBox(height: AppSpacing.md),
            _dropdown(
              label: 'City / Municipality',
              value: _cityCode,
              options: cities,
              icon: Icons.location_city_outlined,
              onChanged: (v) => setState(() {
                _cityCode = v;
                _barangayCode = null;
                _emit(data);
              }),
            ),
            const SizedBox(height: AppSpacing.md),
            _dropdown(
              label: 'Barangay',
              value: _barangayCode,
              options: barangays,
              icon: Icons.home_work_outlined,
              onChanged: (v) => setState(() {
                _barangayCode = v;
                _emit(data);
              }),
            ),
            const SizedBox(height: AppSpacing.md),
            _ZipRow(zip: zip),
          ],
        );
      },
    );
  }
}

class _ZipRow extends StatelessWidget {
  const _ZipRow({required this.zip});

  final String? zip;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppTheme.surfaceContainer,
        borderRadius: AppRadius.rMd,
      ),
      child: Row(
        children: [
          Icon(
            Icons.markunread_mailbox_outlined,
            color: AppTheme.onSurfaceVariant,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ZIP code',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.onSurface,
                      ),
                ),
                Text(
                  zip ?? 'Auto-filled once a city is picked',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
          if (zip != null)
            Text(
              zip!,
              style: AppTheme.monoStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      ),
    );
  }
}
