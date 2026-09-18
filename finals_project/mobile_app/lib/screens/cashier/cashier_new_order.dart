import 'dart:async';
import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../models/inventory_item.dart';
import '../../models/order.dart';
import '../../models/user_address.dart';
import '../../services/firebase_inventory.dart' as fb_inventory;
import '../../services/firebase_orders.dart' as fb_orders;
import '../../services/order_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';
import '../../widgets/address_cascade.dart';
import 'cashier_order_confirmed.dart';

/// The New Order screen - Cashier's second tab.
///
/// Multi-step form: Customer - Details - Schedule.
/// Uses [PfTextField], [PfCard], [PfSegmentedControl], [PfButton].
/// Sticky bottom action bar: Save Draft / Create Order.
class CashierNewOrderScreen extends StatefulWidget {
  const CashierNewOrderScreen({super.key});

  @override
  State<CashierNewOrderScreen> createState() => _CashierNewOrderScreenState();
}

class _CashierNewOrderScreenState extends State<CashierNewOrderScreen> {
  int _currentStep = 0;
  final _formKey = GlobalKey<FormState>();
  late final PageController _pageController =
      PageController(initialPage: _currentStep);

  void _goToStep(int step) {
    setState(() => _currentStep = step);
    _pageController.jumpToPage(step);
  }

  // Customer fields
  final _customerNameCtrl = TextEditingController();
  final _customerEmailCtrl = TextEditingController();
  final _customerPhoneCtrl = TextEditingController();
  UserAddress _addressValue = const UserAddress();

  // Order details
  String _selectedItemType = 'T-Shirt';
  final _quantityCtrl = TextEditingController(text: '1');
  final _layoutFileCtrl = TextEditingController();
  final _paymentAmountCtrl = TextEditingController(text: '0.00');
  // Canonical POS terms: 'Unpaid' | 'Partially Paid' | 'Paid'.
  // Legacy values ('Full Paid', 'Incomplete', 'Partial') still parse
  // everywhere - they are just no longer offered as choices.
  String _paymentStatus = 'Unpaid';
  String _paymentMethod = 'Cash'; // 'Cash' | 'E-Wallets' | 'Bank Transfer'

  // Schedule
  DateTime? _selectedTargetDate;

  final List<String> _itemTypes = [
    'T-Shirt',
    'Hoodie',
    'Mug',
    'Tote Bag',
    'Cap',
    'Sticker',
    'Poster',
    'Custom',
  ];

  // Live inventory snapshot, subscribed in initState. Empty until the first
  // snapshot arrives. The availability check + customer picker both read
  // from this list.
  List<InventoryItem> _inventory = const <InventoryItem>[];
  StreamSubscription<List<InventoryItem>>? _inventorySub;
  bool _feedErrorShown = false;

  /// Feed failures keep last-known values (availability check degrades
  /// gracefully) but must be visible, not silent.
  void _onFeedError(Object e) {
    debugPrint('[new-order] feed failed: $e');
    if (!mounted || _feedErrorShown) return;
    _feedErrorShown = true;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Live data paused - showing last known stock.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
  List<Map<String, dynamic>> _derivedCustomers = const <Map<String, dynamic>>[];
  StreamSubscription<List<Order>>? _ordersSub;

  @override
  void initState() {
    super.initState();
    _inventorySub = fb_inventory.subscribeInventoryStream().listen(
      (items) {
        if (mounted) setState(() => _inventory = items);
      },
      onError: _onFeedError,
    );
    _ordersSub = fb_orders.subscribeOrdersStream().listen(
      (orders) {
        if (mounted) {
          setState(() => _derivedCustomers = _buildCustomers(orders));
        }
      },
      onError: _onFeedError,
    );
  }

  @override
  void dispose() {
    _inventorySub?.cancel();
    _ordersSub?.cancel();
    _customerNameCtrl.dispose();
    _customerEmailCtrl.dispose();
    _customerPhoneCtrl.dispose();
    _quantityCtrl.dispose();
    _layoutFileCtrl.dispose();
    _paymentAmountCtrl.dispose();
    _pageController.dispose();
    super.dispose();
  }

  /// Derives a customer list from live orders (grouped by `customerName`).
  /// Mirrors the cashier_customers derivation so the picker matches what the
  /// customer list screen shows.
  List<Map<String, dynamic>> _buildCustomers(List<Order> orders) {
    final byName = <String, Map<String, dynamic>>{};
    for (final o in orders) {
      final name = o.customerName.trim();
      if (name.isEmpty) continue;
      final existing = byName[name];
      if (existing == null) {
        byName[name] = {
          'name': name,
          'email': o.customerEmail ?? '',
          'phone': o.customerPhone ?? '',
          'region': o.customerRegion,
          'province': o.customerProvince,
          'city': o.customerCity,
          'barangay': o.customerBarangay,
          'zip': o.customerZip,
        };
      } else {
        if ((existing['email'] as String).isEmpty &&
            (o.customerEmail ?? '').isNotEmpty) {
          existing['email'] = o.customerEmail;
        }
        if ((existing['phone'] as String).isEmpty &&
            (o.customerPhone ?? '').isNotEmpty) {
          existing['phone'] = o.customerPhone;
        }
      }
    }
    final list = byName.values.toList()
      ..sort((a, b) =>
          (a['name'] as String).toLowerCase().compareTo(
            (b['name'] as String).toLowerCase(),
          ));
    return list;
  }

  bool _isSubmitting = false;

  Future<void> _handleSubmit() async {
    if (_isSubmitting) return;
    if (!_isStepValid(_currentStep)) return;

    setState(() => _isSubmitting = true);
    HapticFeedback.mediumImpact();

    // Get auth service
    final auth = AuthProvider.of(context);

    try {
      // Create order via service layer (enforces permissions). The
      // Firestore-write path assigns the real doc id; we read it back
      // from the service return value to surface in the success screen.
      final draft = Order(
        orderId: '',
        customerName: _customerNameCtrl.text.trim(),
        customerEmail: _customerEmailCtrl.text.trim().isEmpty ? null : _customerEmailCtrl.text.trim(),
        customerPhone: _customerPhoneCtrl.text.trim().isEmpty ? null : _customerPhoneCtrl.text.trim(),
        customerRegion: _addressValue.region,
        customerProvince: _addressValue.province,
        customerCity: _addressValue.city,
        customerBarangay: _addressValue.barangay,
        customerZip: _addressValue.zip,
        itemType: _selectedItemType,
        quantity: int.parse(_quantityCtrl.text),
        layoutFile: _layoutFileCtrl.text.isEmpty ? '' : _layoutFileCtrl.text,
        targetDate: _selectedTargetDate!,
        paymentAmount: double.parse(_paymentAmountCtrl.text),
        paymentStatus: _paymentStatus,
        paymentMethod: _paymentMethod,
        status: 'Pending',
        priority: _computePriority(_selectedTargetDate!),
        estimatedCompletion: _selectedTargetDate!.add(const Duration(days: 2)),
        // No ETA signals are live at manual entry - null, never an
        // out-of-vocab placeholder (renderers null-guard this).
        basedOn: null,
        cashierId: auth.currentUser?.id,
        createdAt: DateTime.now(),
      );

      final newOrderId = await OrderService.createOrder(order: draft, auth: auth);
      final order = Order(
        orderId: newOrderId,
        customerName: draft.customerName,
        customerEmail: draft.customerEmail,
        customerPhone: draft.customerPhone,
        customerRegion: draft.customerRegion,
        customerProvince: draft.customerProvince,
        customerCity: draft.customerCity,
        customerBarangay: draft.customerBarangay,
        customerZip: draft.customerZip,
        itemType: draft.itemType,
        quantity: draft.quantity,
        layoutFile: draft.layoutFile,
        targetDate: draft.targetDate,
        paymentAmount: draft.paymentAmount,
        paymentStatus: draft.paymentStatus,
        paymentMethod: draft.paymentMethod,
        status: draft.status,
        priority: draft.priority,
        estimatedCompletion: draft.estimatedCompletion,
        basedOn: draft.basedOn,
        cashierId: draft.cashierId,
        createdAt: draft.createdAt,
      );

      if (!mounted) return;

      // Push the success screen, carrying the inventory check result so the
      // cashier sees an explicit warning when stock is insufficient.
      final availability = _computeAvailability(order.quantity);
      final insufficientStock =
          availability != null && !availability.available;
      final result = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => CashierOrderConfirmedScreen(
            orderId: order.orderId,
            insufficientStock: insufficientStock,
          ),
        ),
      );

      if (!mounted) return;
      if (result == true) {
        _resetForm();
        Navigator.pop(context);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to create order: $e'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppTheme.statusOverdue,
        ),
      );
    }
  }

  /// Returns true if the user has entered any data that would be lost on
  /// pop. Used by [_handleBack] to decide whether to confirm-discard.
  bool _hasUserInput() {
    return _customerNameCtrl.text.trim().isNotEmpty ||
        _customerEmailCtrl.text.trim().isNotEmpty ||
        _customerPhoneCtrl.text.trim().isNotEmpty ||
        _addressValue.isNotEmpty ||
        _layoutFileCtrl.text.isNotEmpty ||
        _selectedTargetDate != null ||
        _paymentAmountCtrl.text != '0.00' ||
        (_quantityCtrl.text != '1') ||
        _paymentStatus != 'Unpaid';
  }

  /// AppBar back handler. Confirms with the user if the form has any input
  /// so an accidental back-tap doesn't silently discard the draft.
  Future<void> _handleBack() async {
    if (!_hasUserInput()) {
      Navigator.pop(context);
      return;
    }
    HapticFeedback.selectionClick();
    final shouldDiscard = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Discard new order?'),
        content: const Text(
          'You have unsaved changes. Going back now will clear all entered '
          'customer, item, and payment details.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Keep editing'),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppTheme.statusOverdue),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    if (shouldDiscard == true && mounted) {
      Navigator.pop(context);
    }
  }

  /// Computes order priority based on target date.
  static String _computePriority(DateTime targetDate) {
    final daysUntil = targetDate.difference(DateTime.now()).inDays;
    if (daysUntil <= 0) return 'Overdue';
    if (daysUntil <= 2) return 'Urgent';
    return 'Upcoming';
  }

  /// Finds the best matching inventory variant for the chosen item type.
  ///
  /// Mirrors the proposal Sec.VII rule: a variant matches if the item_type is
  /// contained in the inventory item_type (case-insensitive). Reads from the
  /// live inventory subscription populated in [initState]. Returns null when
  /// the chosen item type has no corresponding inventory variant (the
  /// cashier can still create the order - it simply has no inventory check).
  InventoryItem? _findInventoryVariant(String itemType) {
    final needle = itemType.toLowerCase().trim();
    for (final item in _inventory) {
      final haystack = item.itemType.toLowerCase();
      if (haystack.contains(needle) || needle.contains(haystack)) {
        return item;
      }
    }
    return null;
  }

  /// Returns the live availability status of the currently selected
  /// item type at the requested quantity. Returns null when no matching
  /// inventory variant exists (no check possible).
  _AvailabilityCheck? _computeAvailability(int quantity) {
    final variant = _findInventoryVariant(_selectedItemType);
    if (variant == null) return null;

    final available = variant.currentStock >= quantity;
    String status;
    Color color;
    String message;
    if (available) {
      if (variant.status == 'Low Stock') {
        status = 'Low Stock';
        color = AppTheme.stockLow;
        message =
            'Stock is low (${variant.currentStock} left). Order will proceed but consider restocking.';
      } else {
        status = 'In Stock';
        color = AppTheme.stockInStock;
        message =
            'Sufficient stock - ${variant.currentStock} units available for ${variant.materialVariantId}.';
      }
    } else {
      status = 'Insufficient Stock';
      color = AppTheme.stockInsufficient;
      message =
          'Only ${variant.currentStock} unit${variant.currentStock == 1 ? '' : 's'} available - short by ${quantity - variant.currentStock}. Notify the owner before proceeding.';
    }
    return _AvailabilityCheck(
      variant: variant,
      available: available,
      status: status,
      color: color,
      message: message,
    );
  }

  /// Resets all form state so the next time the user opens the New
  /// Order tab, they get a clean form instead of a pre-filled one
  /// from a previous order.
  void _resetForm() {
    _customerNameCtrl.clear();
    _customerEmailCtrl.clear();
    _customerPhoneCtrl.clear();
    _addressValue = const UserAddress();
    _quantityCtrl.text = '1';
    _layoutFileCtrl.clear();
    _paymentAmountCtrl.text = '0.00';
    _selectedTargetDate = null;
    _selectedItemType = 'T-Shirt';
    _paymentStatus = 'Unpaid';
    _paymentMethod = 'Cash';
    _currentStep = 0;
    if (_pageController.hasClients) {
      _pageController.jumpToPage(0);
    }
    setState(() {});
  }

  bool _isStepValid(int step) {
    switch (step) {
      case 0: // Customer
        return _customerNameCtrl.text.trim().isNotEmpty;
      case 1: // Details
        return int.tryParse(_quantityCtrl.text) != null &&
            int.parse(_quantityCtrl.text) > 0 &&
            double.tryParse(_paymentAmountCtrl.text) != null;
      case 2: // Schedule
        return _selectedTargetDate != null;
      default:
        return false;
    }
  }

  /// Triggers a rebuild so the action bar's enabled state re-evaluates
  /// against the current controller values. Used as the `onChanged` callback
  /// on every text field that participates in step validation.
  void _onValidationFieldChanged(String _) {
    if (mounted) setState(() {});
  }

  Future<void> _pickTargetDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedTargetDate ?? DateTime.now().add(const Duration(days: 3)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(context).colorScheme.copyWith(
            primary: AppTheme.primary,
          ),
        ),
        child: child!,
      ),
    );
    if (date != null && mounted) {
      setState(() => _selectedTargetDate = date);
    }
  }

  void _showCustomerPicker() {
    HapticFeedback.selectionClick();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CustomerPickerSheet(
        customers: _derivedCustomers,
        onSelect: (customer) {
          setState(() {
            _customerNameCtrl.text = customer['name'] as String;
            _customerEmailCtrl.text = customer['email'] as String;
            _customerPhoneCtrl.text = customer['phone'] as String;
            // Hydrate the address cascade if the customer has a stored one.
            // Falls back to an empty UserAddress (cascade clears) when none
            // is set, so the cashier can still re-pick.
            final region = customer['region'] as String?;
            if (region == null) {
              _addressValue = const UserAddress();
            } else {
              _addressValue = UserAddress(
                region: region,
                province: customer['province'] as String?,
                city: customer['city'] as String?,
                barangay: customer['barangay'] as String?,
                zip: customer['zip'] as String?,
              );
            }
          });
          Navigator.pop(context);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('New Order'),
        backgroundColor: AppTheme.surface,
        foregroundColor: AppTheme.onSurface,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: _handleBack,
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Step indicator
            _buildStepIndicator(),
            // Form content
            Expanded(
              child: Form(
                key: _formKey,
                child: PageView(
                  physics: const NeverScrollableScrollPhysics(),
                  controller: _pageController,
                  onPageChanged: (index) => setState(() => _currentStep = index),
                  children: [
                    _buildCustomerSection(),
                    _buildDetailsSection(),
                    _buildScheduleSection(),
                  ],
                ),
              ),
            ),
            // Sticky action bar
            _buildActionBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    final steps = [
      ('Customer', Icons.person_outline_rounded),
      ('Details', Icons.info_outline_rounded),
      ('Schedule', Icons.calendar_month_outlined),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          for (int i = 0; i < steps.length; i++) ...[
            _StepCircle(
              index: i + 1,
              label: steps[i].$1,
              icon: steps[i].$2,
              isActive: i == _currentStep,
              isCompleted: i < _currentStep,
            ),
            if (i < steps.length - 1)
              Expanded(
                child: AnimatedContainer(
                  duration: AppMotion.base,
                  height: 2,
                  margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  decoration: BoxDecoration(
                    color: i < _currentStep ? AppTheme.primary : AppTheme.surfaceContainer,
                    borderRadius: BorderRadius.circular(1),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildCustomerSection() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: StaggeredFadeIn(
        stagger: const Duration(milliseconds: 60),
        duration: AppMotion.base,
        children: [
          const PfSectionHeader(
            title: 'Customer Information',
            subtitle: 'Enter or select customer details',
          ),
          const SizedBox(height: AppSpacing.lg),
          PfTextField(
            label: 'Customer Name *',
            hintText: 'Enter full name',
            controller: _customerNameCtrl,
            prefixIcon: Icons.person_outline_rounded,
            onChanged: _onValidationFieldChanged,
            validator: (v) => v?.trim().isEmpty ?? true ? 'Required' : null,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.md),
          PfTextField(
            label: 'Email',
            hintText: 'customer@email.com',
            controller: _customerEmailCtrl,
            prefixIcon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.md),
          PfTextField(
            label: 'Phone',
            hintText: '+63 9XX XXX XXXX',
            controller: _customerPhoneCtrl,
            prefixIcon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: AppSpacing.xl),
          const PfSectionHeader(
            title: 'Address',
            subtitle: 'Region, province, city, barangay (optional)',
          ),
          const SizedBox(height: AppSpacing.md),
          AddressCascade(
            value: _addressValue,
            onChange: (next) => setState(() => _addressValue = next),
          ),
          const SizedBox(height: AppSpacing.xl),
          PfButton.outlined(
            label: 'Select Existing Customer',
            icon: Icons.search_rounded,
            fullWidth: true,
            onPressed: _showCustomerPicker,
          ),
        ],
      ),
    );
  }

  Widget _buildDetailsSection() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: StaggeredFadeIn(
        stagger: const Duration(milliseconds: 60),
        duration: AppMotion.base,
        children: [
          const PfSectionHeader(
            title: 'Order Details',
            subtitle: 'Product specifications',
          ),
          const SizedBox(height: AppSpacing.lg),
          // Item type selector
          Text(
            'Item Type',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: _itemTypes.map((type) {
              final isSelected = _selectedItemType == type;
              return _ItemTypeOption(
                label: type,
                isSelected: isSelected,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _selectedItemType = type);
                },
              );
            }).toList(),
          ),
          const SizedBox(height: AppSpacing.lg),
          PfTextField(
            label: 'Quantity *',
            hintText: '1',
            controller: _quantityCtrl,
            prefixIcon: Icons.format_list_numbered_rounded,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: _onValidationFieldChanged,
            validator: (v) {
              if (v == null || v.isEmpty) return 'Required';
              final n = int.tryParse(v);
              if (n == null || n <= 0) return 'Must be > 0';
              return null;
            },
            textInputAction: TextInputAction.next,
          ),
          // Live inventory availability indicator - proposal Sec.VII.
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: _quantityCtrl,
            builder: (context, value, _) {
              final qty = int.tryParse(value.text) ?? 0;
              if (qty <= 0) return const SizedBox.shrink();
              final check = _computeAvailability(qty);
              if (check == null) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(top: AppSpacing.md),
                child: _AvailabilityBanner(check: check),
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          // Layout upload
          Text(
            'Layout File',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          _LayoutUploadArea(
            controller: _layoutFileCtrl,
            // Receives the Storage download URL (or the bare filename when
            // the upload fell back) - that string is what `layout_file`
            // persists.
            onFileSelected: (storedValue) {
              setState(() => _layoutFileCtrl.text = storedValue);
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          // Payment section
          const PfSectionHeader(
            title: 'Payment',
            subtitle: 'Amount, status, and method',
          ),
          const SizedBox(height: AppSpacing.md),
          PfTextField(
            label: 'Amount (₱) *',
            hintText: '0.00',
            controller: _paymentAmountCtrl,
            prefixIcon: Icons.attach_money_rounded,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
            onChanged: _onValidationFieldChanged,
            validator: (v) {
              if (v == null || v.isEmpty) return 'Required';
              final d = double.tryParse(v);
              if (d == null || d < 0) return 'Invalid amount';
              return null;
            },
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Payment Status',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          PfSegmentedControl<String>(
            value: _paymentStatus,
            options: const [
              PfSegmentOption(value: 'Unpaid', label: 'Unpaid'),
              PfSegmentOption(value: 'Partially Paid', label: 'Partially Paid'),
              PfSegmentOption(value: 'Paid', label: 'Paid'),
            ],
            onChanged: (v) {
              HapticFeedback.selectionClick();
              setState(() => _paymentStatus = v);
            },
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Payment Method',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          PfSegmentedControl<String>(
            value: _paymentMethod,
            options: const [
              PfSegmentOption(value: 'Cash', label: 'Cash'),
              PfSegmentOption(value: 'E-Wallets', label: 'E-Wallets'),
              PfSegmentOption(value: 'Bank Transfer', label: 'Bank Transfer'),
            ],
            onChanged: (v) {
              HapticFeedback.selectionClick();
              setState(() => _paymentMethod = v);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildScheduleSection() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: StaggeredFadeIn(
        stagger: const Duration(milliseconds: 60),
        duration: AppMotion.base,
        children: [
          const PfSectionHeader(
            title: 'Schedule',
            subtitle: 'Target completion date',
          ),
          const SizedBox(height: AppSpacing.lg),
          PfCard(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              children: [
                Icon(
                  Icons.event_outlined,
                  size: 48,
                  color: _selectedTargetDate != null
                      ? AppTheme.primary
                      : AppTheme.onSurfaceVariant,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  _selectedTargetDate == null
                      ? 'No date selected'
                      : '${_selectedTargetDate!.day}/${_selectedTargetDate!.month}/${_selectedTargetDate!.year}',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: _selectedTargetDate != null
                        ? AppTheme.onSurface
                        : AppTheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  _selectedTargetDate == null
                      ? 'Tap to select target completion date'
                      : 'Target completion date',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.lg),
                PfButton.filled(
                  label: _selectedTargetDate == null ? 'Select Date' : 'Change Date',
                  icon: Icons.calendar_month_rounded,
                  fullWidth: true,
                  onPressed: _pickTargetDate,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          // Summary
          PfCard(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Order Summary',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                _SummaryField(
                  label: 'Customer',
                  controller: _customerNameCtrl,
                  placeholder: '-',
                ),
                _SummaryField(
                  label: 'Address',
                  controller: null,
                  value: _addressValue.summary().isEmpty
                      ? '-'
                      : _addressValue.summary(),
                ),
                _SummaryField(
                  label: 'Item',
                  controller: null,
                  value: _selectedItemType,
                ),
                _SummaryField(
                  label: 'Quantity',
                  controller: _quantityCtrl,
                  value: '1',
                ),
                _SummaryField(
                  label: 'Layout',
                  controller: _layoutFileCtrl,
                  placeholder: '-',
                ),
                _SummaryField(
                  label: 'Amount',
                  controller: _paymentAmountCtrl,
                  value: '0.00',
                  prefix: '₱',
                ),
                _SummaryField(
                  label: 'Payment Status',
                  controller: null,
                  value: _paymentStatus,
                ),
                _SummaryField(
                  label: 'Method',
                  controller: null,
                  value: _paymentMethod,
                ),
                _SummaryField(
                  label: 'Target Date',
                  controller: null,
                  value: _selectedTargetDate == null
                      ? 'Not set'
                      : '${_selectedTargetDate!.day}/${_selectedTargetDate!.month}/${_selectedTargetDate!.year}',
                ),
                if (_selectedItemType.isNotEmpty)
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _quantityCtrl,
                    builder: (context, value, _) {
                      final qty = int.tryParse(value.text) ?? 0;
                      if (qty <= 0) return const SizedBox.shrink();
                      final check = _computeAvailability(qty);
                      if (check == null || check.available) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.md),
                        child: _AvailabilityBanner(check: check),
                      );
                    },
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionBar() {
    final canProceed = _isStepValid(_currentStep);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (_currentStep > 0)
              Expanded(
                child: PfButton.outlined(
                  label: 'Back',
                  icon: Icons.arrow_back_rounded,
                  fullWidth: true,
                  onPressed: () => _goToStep(_currentStep - 1),
                ),
              ),
            if (_currentStep > 0) const SizedBox(width: AppSpacing.md),
            Expanded(
              flex: 2,
              child: _currentStep < 2
                  ? PfButton.filled(
                      label: 'Next',
                      icon: Icons.arrow_forward_rounded,
                      fullWidth: true,
                      onPressed:
                          canProceed ? () => _goToStep(_currentStep + 1) : null,
                    )
                  : PfButton.filled(
                      label: _isSubmitting ? 'Creating...' : 'Create Order',
                      icon: Icons.check_circle_rounded,
                      fullWidth: true,
                      size: PfButtonSize.large,
                      loading: _isSubmitting,
                      onPressed: _handleSubmit,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ItemTypeOption extends StatelessWidget {
  const _ItemTypeOption({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: AppMotion.fast,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : AppTheme.surface,
          borderRadius: AppRadius.rMd,
          border: Border.all(
            color: isSelected
                ? AppTheme.primary
                : Theme.of(context).colorScheme.outlineVariant,
            width: 2,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isSelected)
              Icon(Icons.check_rounded, size: AppIconSize.sm, color: AppTheme.onPrimary),
            if (isSelected) const SizedBox(width: AppSpacing.xs),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: isSelected ? AppTheme.onPrimary : AppTheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepCircle extends StatelessWidget {
  const _StepCircle({
    required this.index,
    required this.label,
    required this.icon,
    required this.isActive,
    required this.isCompleted,
  });

  final int index;
  final String label;
  final IconData icon;
  final bool isActive;
  final bool isCompleted;

  @override
  Widget build(BuildContext context) {
    final color = isCompleted
        ? AppTheme.statusCompleted
        : isActive
            ? AppTheme.primary
            : AppTheme.onSurfaceVariant;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: AppMotion.base,
          width: AppIconSize.xl,
          height: AppIconSize.xl,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isCompleted || isActive ? color : AppTheme.surfaceContainer,
            border: Border.all(
              color: isCompleted || isActive ? color : AppTheme.surfaceContainer,
              width: 2,
            ),
          ),
          child: Center(
            child: isCompleted
                ? Icon(Icons.check_rounded, size: AppIconSize.sm, color: AppTheme.onPrimary)
                : Icon(icon, size: AppIconSize.sm, color: isActive ? AppTheme.onPrimary : AppTheme.onSurfaceVariant),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          style: TextStyle(
            fontSize: AppTypography.caption,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
            color: isActive ? AppTheme.primary : AppTheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppTheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          // Bounded + ellipsized: long values (layout URLs, addresses)
          // must never overflow the card (right-overflow red-screen).
          Flexible(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.right,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

/// A summary row that subscribes to a [TextEditingController] via
/// [ValueListenableBuilder], so the value updates live as the user types
/// in the Customer or Details steps - even when the Schedule page was
/// built earlier and is now off-screen in a [PageView].
class _SummaryField extends StatelessWidget {
  const _SummaryField({
    required this.label,
    this.controller,
    this.value,
    this.prefix = '',
    this.placeholder = '-',
  }) : assert(
          controller != null || value != null,
          'Provide either controller or value',
        );

  final String label;
  final TextEditingController? controller;
  final String? value;
  final String prefix;
  final String placeholder;

  @override
  Widget build(BuildContext context) {
    if (controller != null) {
      return ValueListenableBuilder<TextEditingValue>(
        valueListenable: controller!,
        builder: (context, v, _) {
          final text = v.text.isEmpty ? placeholder : '$prefix${v.text}';
          return _SummaryRow(label: label, value: text);
        },
      );
    }
    return _SummaryRow(label: label, value: '$prefix${value!}');
  }
}

/// Drag-and-drop / tap-to-upload area for layout files.
/// Updates the controller with the selected file name.
class _LayoutUploadArea extends StatefulWidget {
  const _LayoutUploadArea({
    required this.controller,
    required this.onFileSelected,
  });

  final TextEditingController controller;
  final void Function(String) onFileSelected;

  @override
  State<_LayoutUploadArea> createState() => _LayoutUploadAreaState();
}

class _LayoutUploadAreaState extends State<_LayoutUploadArea> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: _pickFile,
        child: AnimatedContainer(
          duration: AppMotion.fast,
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: _isHovered ? AppTheme.primary.withValues(alpha: 0.04) : AppTheme.surfaceContainerLow,
            border: Border.all(
              color: _isHovered ? AppTheme.primary : AppTheme.surfaceContainer,
              width: 2,
              style: BorderStyle.solid,
            ),
            borderRadius: AppRadius.rMd,
          ),
          child: Column(
            children: [
              Icon(
                Icons.cloud_upload_outlined,
                size: 32,
                color: _isHovered ? AppTheme.primary : AppTheme.onSurfaceVariant,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Tap to upload layout file',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: _isHovered ? AppTheme.primary : AppTheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                _uploading ? 'Uploading...' : 'PDF, JPG, PNG - Max 5MB',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.onSurfaceVariant,
                ),
              ),
              if (_uploading) ...[
                const SizedBox(height: AppSpacing.sm),
                const SizedBox(
                  width: 160,
                  child: LinearProgressIndicator(),
                ),
              ],
              if (widget.controller.text.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.1),
                    borderRadius: AppRadius.rSm,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.insert_drive_file_rounded,
                        size: AppIconSize.sm,
                        color: AppTheme.primary,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        widget.controller.text,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                          color: AppTheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// Picks a layout file from the device (PDF/JPG/PNG, max 5 MB) and
  /// uploads it to Cloudinary (free tier, unsigned preset). The delivery
  /// URL travels with the order in `layout_file`, so Production Staff can
  /// open the actual file on any device. If the upload fails, the bare
  /// filename is kept as a fallback reference instead of losing the pick.
  static const _maxLayoutBytes = 5 * 1024 * 1024;

  bool _uploading = false;

  Future<void> _pickFile() async {
    if (_uploading) return;
    HapticFeedback.selectionClick();
    // file_picker v12 static API: single pick returns PlatformFile?,
    // null when the user cancels.
    late final PlatformFile? file;
    try {
      file = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png'],
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open the file picker. Try again.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (file == null || !mounted) {
      return; // user cancelled
    }
    // Exact byte count (falls back to reading the file when the picker
    // did not report a size). Guarded: unreadable files are rejected
    // instead of crashing the form.
    late final int byteCount;
    try {
      byteCount = file.lengthSync() ?? await file.length();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not read that file. Try another one.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (byteCount > _maxLayoutBytes) {
      if (!mounted) return;
      final mb = (byteCount / (1024 * 1024)).toStringAsFixed(1);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '"${file.name}" is $mb MB - layout files must be 5 MB or smaller.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() => _uploading = true);
    try {
      final url = await _uploadLayout(file);
      if (!mounted) return;
      widget.onFileSelected(url);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Layout uploaded: ${file.name}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      // Upload failed (offline, preset misconfigured): keep the filename
      // so the order still records which file the cashier picked.
      if (!mounted) return;
      widget.onFileSelected(file.name);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Upload failed - filename saved instead.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  /// Uploads the picked file bytes to Cloudinary (unsigned preset) and
  /// returns the secure delivery URL. Free tier, no Firebase Blaze needed.
  /// file_picker v12 exposes content via `readAsBytes()` (no `.bytes`).
  /// The `auto` resource type accepts both images and PDFs.
  static const _cloudinaryCloud = 'nvfwbwqo';
  static const _cloudinaryPreset = 'brialyns_artsign';

  Future<String> _uploadLayout(PlatformFile file) async {
    final Uint8List bytes = await file.readAsBytes();
    if (bytes.isEmpty) throw StateError('Empty file: ${file.name}');
    final safeName = file.name.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final uri = Uri.https(
      'api.cloudinary.com',
      '/v1_1/$_cloudinaryCloud/auto/upload',
    );
    final request = http.MultipartRequest('POST', uri)
      ..fields['upload_preset'] = _cloudinaryPreset
      ..fields['public_id'] =
          'printflow_layouts/${DateTime.now().millisecondsSinceEpoch}_$safeName'
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: safeName));
    final streamed = await request.send().timeout(const Duration(seconds: 60));
    final body = await streamed.stream.bytesToString();
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      throw StateError('Cloudinary upload failed (${streamed.statusCode})');
    }
    final json = jsonDecode(body) as Map<String, dynamic>;
    final url = json['secure_url'] as String?;
    if (url == null || url.isEmpty) throw StateError('No secure_url returned');
    return url;
  }
}

/// Internal model describing the live availability state for the currently
/// selected item type + quantity.
class _AvailabilityCheck {
  const _AvailabilityCheck({
    required this.variant,
    required this.available,
    required this.status,
    required this.color,
    required this.message,
  });

  final InventoryItem variant;
  final bool available;
  final String status;
  final Color color;
  final String message;
}

/// Inline availability indicator shown in the Details step of the New Order
/// form. Reuses [PfStatusBadge.stock] for the status pill and the design
/// system colors so the visual language matches the rest of the app.
class _AvailabilityBanner extends StatelessWidget {
  const _AvailabilityBanner({required this.check});

  final _AvailabilityCheck check;

  @override
  Widget build(BuildContext context) {
    final tint = check.color.withValues(alpha: 0.10);
    final border = check.color.withValues(alpha: 0.30);
    final iconData = check.available
        ? (check.status == 'Low Stock'
            ? Icons.warning_amber_rounded
            : Icons.check_circle_rounded)
        : Icons.error_outline_rounded;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: tint,
        borderRadius: AppRadius.rMd,
        border: Border.all(color: border, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(iconData, color: check.color, size: AppIconSize.md),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Inventory check',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppTheme.onSurface,
                            ),
                      ),
                    ),
                    PfStatusBadge.stock(check.status, size: PfBadgeSize.small),
                  ],
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  check.variant.itemType,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.onSurface,
                      ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  check.message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    _miniStat(
                      context,
                      label: 'Stock',
                      value: '${check.variant.currentStock}',
                    ),
                    const SizedBox(width: AppSpacing.md),
                    _miniStat(
                      context,
                      label: 'Reorder',
                      value: '${check.variant.reorderPoint}',
                    ),
                    const SizedBox(width: AppSpacing.md),
                    _miniStat(
                      context,
                      label: 'Forecast 7d',
                      value: '${check.variant.forecastedDemandNext7Days}',
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniStat(BuildContext context,
      {required String label, required String value}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                fontSize: AppTypography.caption,
                letterSpacing: 0.6,
                color: AppTheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          value,
          style: AppTheme.monoStyle(
            fontSize: AppTypography.bodySm,
            fontWeight: FontWeight.w700,
            color: AppTheme.onSurface,
          ),
        ),
      ],
    );
  }
}

/// Bottom sheet for picking an existing customer.
class _CustomerPickerSheet extends StatelessWidget {
  const _CustomerPickerSheet({
    required this.customers,
    required this.onSelect,
  });

  final List<Map<String, dynamic>> customers;
  final void Function(Map<String, dynamic>) onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: AppSpacing.md),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppTheme.onSurfaceVariant.withValues(alpha: 0.3),
              borderRadius: AppRadius.rPill,
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Text(
                  'Select Customer',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          // Customer list (or empty state when no orders exist yet)
          Expanded(
            child: customers.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.people_alt_outlined,
                            size: 40,
                            color: AppTheme.onSurfaceVariant,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            'No saved customers yet',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'Customers are added automatically when you create an order in their name.',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppTheme.onSurfaceVariant,
                                ),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    itemCount: customers.length,
                    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                    itemBuilder: (context, index) {
                      final customer = customers[index];
                      return PressScale(
                        onTap: () => onSelect(customer),
                        child: PfCard(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          child: Row(
                            children: [
                              PfAvatar(name: customer['name'] as String),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      customer['name'] as String,
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(height: AppSpacing.xxs),
                                    Text(
                                      (customer['email'] as String?) ?? '',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: AppTheme.onSurfaceVariant,
                                      ),
                                    ),
                                    Text(
                                      (customer['phone'] as String?) ?? '',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: AppTheme.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Icon(
                                Icons.chevron_right_rounded,
                                color: AppTheme.onSurfaceVariant,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}