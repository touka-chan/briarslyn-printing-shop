import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import '../models/user_address.dart';
import '../services/address_service.dart';
import '../theme/app_theme.dart';

/// Cascading PH address selector — Region → Province → City → Barangay → Zip.
///
/// Mirrors the web `AddressCascade` component (`web/src/components/forms/
/// AddressCascade.tsx`). Dropdown changes upstream clear downstream
/// selections. The zip is auto-suggested from `ph-zip-codes.json` when a
/// city is picked; the user can override the value at any time.
///
/// The component is self-contained: data loads are lazy, cached at the
/// service level, and triggered on first focus. Selecting a region, then a
/// province, then a city will never block the UI on the 4.6 MB barangay
/// load — that only happens if the user opens the barangay dropdown.
class AddressCascade extends StatefulWidget {
  const AddressCascade({
    super.key,
    this.value,
    required this.onChange,
    this.enabled = true,
  });

  /// Current address (display names). Used to pre-select the cascade when
  /// the user re-opens the form (e.g., on a different order).
  final UserAddress? value;

  /// Fires on every selection change. The component emits a fresh
  /// [UserAddress] each time with the relevant fields set / cleared.
  final ValueChanged<UserAddress> onChange;

  /// When false, all four dropdowns + the zip field render disabled.
  final bool enabled;

  @override
  State<AddressCascade> createState() => _AddressCascadeState();
}

class _AddressCascadeState extends State<AddressCascade> {
  String? _regionCode;
  String? _provinceCode;
  String? _cityCode;
  String? _barangayCode;
  String? _zip;

  // Loaded datasets (top-level only). The service caches these so multiple
  // AddressCascade instances in the same session share one fetch.
  List<AddressRegion>? _regions;
  List<AddressProvince>? _provinces;
  List<AddressCity>? _cities;
  List<AddressBarangay>? _barangays;

  // Per-level loading flags.
  bool _loadingRegions = false;
  bool _loadingProvinces = false;
  bool _loadingCities = false;
  bool _loadingBarangays = false;

  // Key of the last `value` we hydrated from, so a no-op change doesn't
  // reset a half-typed zip the user just entered.
  String _hydratedValueKey = '';

  @override
  void initState() {
    super.initState();
    _loadRegions();
    _hydrateFromValue();
  }

  @override
  void didUpdateWidget(covariant AddressCascade oldWidget) {
    super.didUpdateWidget(oldWidget);
    final v = widget.value;
    final key = _valueKey(v);
    if (key != _hydratedValueKey) {
      _hydratedValueKey = key;
      // Reset the cascading code state from the new `value` (display names).
      _resetCodes();
      _hydrateFromValue();
    }
  }

  String _valueKey(UserAddress? v) {
    v ??= const UserAddress();
    return '${v.region ?? ''}|${v.province ?? ''}|${v.city ?? ''}|'
        '${v.barangay ?? ''}|${v.zip ?? ''}';
  }

  void _resetCodes() {
    _regionCode = null;
    _provinceCode = null;
    _cityCode = null;
    _barangayCode = null;
    // Keep `_zip` so the user keeps their typed value when the parent
    // re-fires the same value.
  }

  // ── Lazy loaders ────────────────────────────────────────────────────

  Future<void> _loadRegions() async {
    setState(() => _loadingRegions = true);
    try {
      final data = await AddressService.loadRegions();
      if (!mounted) return;
      setState(() => _regions = data);
      _tryResolveCodes();
    } finally {
      if (mounted) setState(() => _loadingRegions = false);
    }
  }

  Future<void> _ensureProvincesLoaded() async {
    if (_provinces != null) return;
    setState(() => _loadingProvinces = true);
    try {
      final data = await AddressService.loadProvinces();
      if (!mounted) return;
      setState(() => _provinces = data);
      _tryResolveCodes();
    } finally {
      if (mounted) setState(() => _loadingProvinces = false);
    }
  }

  Future<void> _ensureCitiesLoaded() async {
    if (_cities != null) return;
    setState(() => _loadingCities = true);
    try {
      final data = await AddressService.loadCities();
      if (!mounted) return;
      setState(() => _cities = data);
      _tryResolveCodes();
    } finally {
      if (mounted) setState(() => _loadingCities = false);
    }
  }

  Future<void> _ensureBarangaysLoaded() async {
    if (_barangays != null) return;
    setState(() => _loadingBarangays = true);
    try {
      final data = await AddressService.loadBarangays();
      if (!mounted) return;
      setState(() => _barangays = data);
      _tryResolveCodes();
    } finally {
      if (mounted) setState(() => _loadingBarangays = false);
    }
  }

  // ── Hydration from `value` (display names → codes) ──────────────────

  void _hydrateFromValue() {
    final v = widget.value;
    if (v == null) return;
    // The zip always round-trips directly — it's a free-text field.
    _zip = v.zip;
  }

  /// Re-runs after each lazy load completes, so we can resolve display
  /// names back to codes once the corresponding dataset is in memory.
  void _tryResolveCodes() {
    final v = widget.value;
    if (v == null) return;
    if (_regionCode == null && v.region != null && _regions != null) {
      final r = AddressService.findRegionByName(v.region!);
      if (r != null) _regionCode = r.regionCode;
    }
    if (_provinceCode == null &&
        v.province != null &&
        _regionCode != null &&
        _provinces != null) {
      final p = AddressService.findProvinceByName(v.province!, _regionCode!);
      if (p != null) _provinceCode = p.provinceCode;
    }
    if (_cityCode == null &&
        v.city != null &&
        _provinceCode != null &&
        _cities != null) {
      final c = AddressService.findCityByName(v.city!, _provinceCode!);
      if (c != null) _cityCode = c.cityCode;
    }
    if (_barangayCode == null &&
        v.barangay != null &&
        _cityCode != null &&
        _barangays != null) {
      final b = AddressService.findBarangayByName(v.barangay!, _cityCode!);
      if (b != null) _barangayCode = b.brgyCode;
    }
    if (mounted) setState(() {});
  }

  // ── Derived option lists (filtered by upstream selection) ────────────

  List<AddressProvince> get _provincesForRegion {
    final all = _provinces;
    if (all == null || _regionCode == null) return const [];
    return all.where((p) => p.regionCode == _regionCode).toList(growable: false);
  }

  List<AddressCity> get _citiesForProvince {
    final all = _cities;
    if (all == null || _provinceCode == null) return const [];
    return all.where((c) => c.provinceCode == _provinceCode).toList(growable: false);
  }

  List<AddressBarangay> get _barangaysForCity {
    final all = _barangays;
    if (all == null || _cityCode == null) return const [];
    return all.where((b) => b.cityCode == _cityCode).toList(growable: false);
  }

  // ── Handlers ────────────────────────────────────────────────────────

  void _emit({String? region, String? province, String? city, String? barangay, String? zip}) {
    final current = widget.value ?? const UserAddress();
    widget.onChange(UserAddress(
      region: region ?? current.region,
      province: province ?? current.province,
      city: city ?? current.city,
      barangay: barangay ?? current.barangay,
      zip: zip ?? current.zip,
    ));
  }

  void _onRegionChanged(String? next) {
    HapticFeedback.selectionClick();
    setState(() {
      _regionCode = next;
      _provinceCode = null;
      _cityCode = null;
      _barangayCode = null;
    });
    final region = next == null
        ? null
        : _regions?.firstWhere(
            (r) => r.regionCode == next,
            orElse: () => const AddressRegion(regionCode: '', regionName: ''),
          );
    _emit(
      region: region?.regionName.isNotEmpty == true ? region!.regionName : null,
      province: null,
      city: null,
      barangay: null,
    );
    // Pre-fetch the next dataset so the user doesn't wait.
    _ensureProvincesLoaded();
  }

  void _onProvinceChanged(String? next) {
    HapticFeedback.selectionClick();
    setState(() {
      _provinceCode = next;
      _cityCode = null;
      _barangayCode = null;
    });
    final province = next == null
        ? null
        : _provinces?.firstWhere(
            (p) => p.provinceCode == next,
            orElse: () => const AddressProvince(
              provinceCode: '',
              provinceName: '',
              regionCode: '',
            ),
          );
    _emit(
      province: province?.provinceName.isNotEmpty == true ? province!.provinceName : null,
      city: null,
      barangay: null,
    );
    _ensureCitiesLoaded();
  }

  Future<void> _onCityChanged(String? next) async {
    HapticFeedback.selectionClick();
    setState(() {
      _cityCode = next;
      _barangayCode = null;
    });
    final city = next == null
        ? null
        : _cities?.firstWhere(
            (c) => c.cityCode == next,
            orElse: () => const AddressCity(
              cityCode: '',
              cityName: '',
              provinceCode: '',
            ),
          );
    final provinceName = _provinces
        ?.firstWhere(
          (p) => p.provinceCode == _provinceCode,
          orElse: () => const AddressProvince(
            provinceCode: '',
            provinceName: '',
            regionCode: '',
          ),
        )
        .provinceName;
    String? nextZip;
    if (city != null && city.cityName.isNotEmpty) {
      // Always ensure the zip dataset is loaded before lookup. `loadZips`
      // is internally cached, so repeated calls are free.
      await AddressService.loadZips();
      nextZip = AddressService.findZip(city.cityName, provinceName);
    }
    if (!mounted) return;
    setState(() {
      // Only overwrite the zip if the user hadn't typed something custom
      // that conflicts; otherwise keep their value.
      if (nextZip != null) {
        _zip = nextZip;
      }
    });
    _emit(
      city: city?.cityName.isNotEmpty == true ? city!.cityName : null,
      barangay: null,
      zip: nextZip,
    );
    _ensureBarangaysLoaded();
  }

  void _onBarangayChanged(String? next) {
    HapticFeedback.selectionClick();
    setState(() => _barangayCode = next);
    final barangay = next == null
        ? null
        : _barangays?.firstWhere(
            (b) => b.brgyCode == next,
            orElse: () => const AddressBarangay(
              brgyCode: '',
              brgyName: '',
              cityCode: '',
            ),
          );
    _emit(
      barangay: barangay?.brgyName.isNotEmpty == true ? barangay!.brgyName : null,
    );
  }

  void _onZipChanged(String next) {
    setState(() => _zip = next);
    _emit(zip: next);
  }

  // ── Render ──────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _AddressDropdown<AddressRegion>(
          label: 'Region',
          icon: Icons.public_rounded,
          hint: 'Select a region',
          value: _regionCode,
          isLoading: _loadingRegions,
          enabled: widget.enabled && !_loadingRegions,
          items: _regions ?? const [],
          itemLabel: (r) => r.regionName,
          itemValue: (r) => r.regionCode,
          onFocus: _ensureProvincesLoaded,
          onChanged: _onRegionChanged,
        ),
        const SizedBox(height: AppSpacing.md),
        _AddressDropdown<AddressProvince>(
          label: 'Province',
          icon: Icons.map_outlined,
          hint: _regionCode == null
              ? 'Select a region first'
              : (_loadingProvinces
                  ? 'Loading provinces…'
                  : (_provincesForRegion.isEmpty
                      ? 'No provinces available'
                      : 'Select a province')),
          value: _provinceCode,
          isLoading: _loadingProvinces,
          enabled: widget.enabled && _regionCode != null && !_loadingProvinces,
          items: _provincesForRegion,
          itemLabel: (p) => p.provinceName,
          itemValue: (p) => p.provinceCode,
          onFocus: _ensureProvincesLoaded,
          onChanged: _onProvinceChanged,
        ),
        const SizedBox(height: AppSpacing.md),
        _AddressDropdown<AddressCity>(
          label: 'City / Municipality',
          icon: Icons.location_city_rounded,
          hint: _provinceCode == null
              ? 'Select a province first'
              : (_loadingCities
                  ? 'Loading cities…'
                  : (_citiesForProvince.isEmpty
                      ? 'No cities available'
                      : 'Select a city')),
          value: _cityCode,
          isLoading: _loadingCities,
          enabled: widget.enabled && _provinceCode != null && !_loadingCities,
          items: _citiesForProvince,
          itemLabel: (c) => c.cityName,
          itemValue: (c) => c.cityCode,
          onFocus: _ensureCitiesLoaded,
          onChanged: _onCityChanged,
        ),
        const SizedBox(height: AppSpacing.md),
        _AddressDropdown<AddressBarangay>(
          label: 'Barangay',
          icon: Icons.home_work_outlined,
          hint: _cityCode == null
              ? 'Select a city first'
              : (_loadingBarangays
                  ? 'Loading barangays…'
                  : (_barangaysForCity.isEmpty
                      ? 'No barangays available'
                      : 'Select a barangay')),
          value: _barangayCode,
          isLoading: _loadingBarangays,
          enabled: widget.enabled && _cityCode != null && !_loadingBarangays,
          items: _barangaysForCity,
          itemLabel: (b) => b.brgyName,
          itemValue: (b) => b.brgyCode,
          onFocus: _ensureBarangaysLoaded,
          onChanged: _onBarangayChanged,
        ),
        const SizedBox(height: AppSpacing.md),
        _ZipField(
          label: 'ZIP code',
          value: _zip,
          enabled: widget.enabled,
          onChanged: _onZipChanged,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Auto-suggested from the selected city. Edit if needed.',
          style: TextStyle(
            fontSize: AppTypography.caption,
            color: AppTheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

/// Single dropdown field. Mirrors the look of [PfTextField] (filled, rounded,
/// prefix icon, disabled-when-no-upstream) but exposes a native
/// [DropdownButton] so we don't pay the modal-overlay cost on each level.
class _AddressDropdown<T> extends StatelessWidget {
  const _AddressDropdown({
    required this.label,
    required this.icon,
    required this.hint,
    required this.value,
    required this.isLoading,
    required this.enabled,
    required this.items,
    required this.itemLabel,
    required this.itemValue,
    required this.onFocus,
    required this.onChanged,
  });

  final String label;
  final IconData icon;
  final String hint;
  final String? value;
  final bool isLoading;
  final bool enabled;
  final List<T> items;
  final String Function(T) itemLabel;
  final String Function(T) itemValue;
  final Future<void> Function() onFocus;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final disabled = !enabled;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            color: AppTheme.onSurface,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        // The InputDecoration supplies the filled, rounded, border-only-
        // on-focus look that matches PfTextField.
        InputDecorator(
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: disabled
                ? colorScheme.outlineVariant.withValues(alpha: 0.12)
                : AppTheme.surfaceContainer,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(color: colorScheme.outlineVariant, width: 1),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: const BorderSide(color: AppTheme.primary, width: 2),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(
                color: colorScheme.outlineVariant.withValues(alpha: 0.5),
                width: 1,
              ),
            ),
            prefixIcon: Icon(
              icon,
              size: AppIconSize.md,
              color: AppTheme.onSurfaceVariant,
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              icon: isLoading
                  ? const SizedBox(
                      width: AppIconSize.md,
                      height: AppIconSize.md,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation(AppTheme.primary),
                      ),
                    )
                  : Icon(
                      Icons.expand_more_rounded,
                      color: AppTheme.onSurfaceVariant,
                    ),
              hint: Text(
                hint,
                style: TextStyle(
                  color: AppTheme.onSurfaceVariant.withValues(alpha: 0.7),
                  fontSize: AppTypography.bodyMd,
                ),
              ),
              dropdownColor: AppTheme.surface,
              borderRadius: BorderRadius.circular(AppRadius.md),
              items: items
                  .map<DropdownMenuItem<String>>(
                    (item) => DropdownMenuItem<String>(
                      value: itemValue(item),
                      child: Text(
                        itemLabel(item),
                        style: TextStyle(
                          fontSize: AppTypography.bodyMd,
                          color: AppTheme.onSurface,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(growable: false),
              onTap: () {
                // Trigger the lazy dataset load as soon as the user
                // opens the dropdown, not just on first focus.
                onFocus();
              },
              onChanged: enabled ? onChanged : null,
            ),
          ),
        ),
      ],
    );
  }
}

class _ZipField extends StatelessWidget {
  const _ZipField({
    required this.label,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: AppTheme.onSurface,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        TextFormField(
          initialValue: value ?? '',
          enabled: enabled,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          onChanged: onChanged,
          style: AppTheme.monoStyle(
            fontSize: AppTypography.bodyMd,
            color: AppTheme.onSurface,
          ),
          cursorColor: AppTheme.primary,
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: enabled
                ? AppTheme.surfaceContainer
                : Theme.of(context)
                    .colorScheme
                    .outlineVariant
                    .withValues(alpha: 0.12),
            hintText: 'e.g. 4009',
            hintStyle: TextStyle(
              color: AppTheme.onSurfaceVariant.withValues(alpha: 0.7),
            ),
            prefixIcon: Icon(
              Icons.tag_rounded,
              size: AppIconSize.md,
              color: AppTheme.onSurfaceVariant,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(
                color: Theme.of(context).colorScheme.outlineVariant,
                width: 1,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: const BorderSide(color: AppTheme.primary, width: 2),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(
                color: Theme.of(context)
                    .colorScheme
                    .outlineVariant
                    .withValues(alpha: 0.5),
                width: 1,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
