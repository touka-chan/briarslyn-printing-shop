import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';
import 'cashier_order_confirmed.dart';

/// The New Order screen — Cashier's second tab.
///
/// Multi-step form: Customer → Details → Schedule.
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

  // Order details
  String _selectedItemType = 'T-Shirt';
  final _quantityCtrl = TextEditingController(text: '1');
  final _layoutFileCtrl = TextEditingController();
  final _paymentAmountCtrl = TextEditingController(text: '0.00');
  String _paymentStatus = 'Unpaid'; // 'Paid' | 'Full Paid' | 'Unpaid' | 'Incomplete'
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

  @override
  void dispose() {
    _customerNameCtrl.dispose();
    _customerEmailCtrl.dispose();
    _customerPhoneCtrl.dispose();
    _quantityCtrl.dispose();
    _layoutFileCtrl.dispose();
    _paymentAmountCtrl.dispose();
    _pageController.dispose();
    super.dispose();
  }

  bool _isSubmitting = false;

  Future<void> _handleSubmit() async {
    if (_isSubmitting) return;
    if (!_isStepValid(_currentStep)) return;

    setState(() => _isSubmitting = true);
    HapticFeedback.mediumImpact();

    // Simulate a brief processing window so the button's loading state
    // is visible — replace with a real API call when the backend is wired.
    await Future.delayed(const Duration(milliseconds: 600));

    if (!mounted) return;

    // Generate a mock order ID in the same shape the backend uses
    // (ORD-####), so the success screen feels real.
    final orderId =
        'ORD-${DateTime.now().millisecondsSinceEpoch.remainder(10000).toString().padLeft(4, '0')}';

    // Push the success screen on top of the form. When it auto-pops
    // (or the user taps "Back to Home"), we pop the form. The shell's
    // IndexedStack then returns to the Home tab (index 0) so the user
    // doesn't see a stale New Order screen after confirmation.
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CashierOrderConfirmedScreen(orderId: orderId),
      ),
    );

    // If the success screen returned true (either via the auto-pop
    // timer or the manual "Back to Home" button), reset the form and
    // pop back. The parent shell will show the Home tab because the
    // New Order form is the only screen above the IndexedStack.
    if (!mounted) return;
    if (result == true) {
      _resetForm();
      Navigator.pop(context);
    }
  }

  /// Resets all form state so the next time the user opens the New
  /// Order tab, they get a clean form instead of a pre-filled one
  /// from a previous order.
  void _resetForm() {
    _customerNameCtrl.clear();
    _customerEmailCtrl.clear();
    _customerPhoneCtrl.clear();
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
          onPressed: () => Navigator.pop(context),
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
            color: AppTheme.surfaceContainer,
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
          PfButton.outlined(
            label: 'Select Existing Customer',
            icon: Icons.search_rounded,
            fullWidth: true,
            onPressed: () {
              HapticFeedback.selectionClick();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Customer picker - coming soon'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
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
            onFileSelected: (fileName) {
              setState(() => _layoutFileCtrl.text = fileName);
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
              PfSegmentOption(value: 'Paid', label: 'Paid'),
              PfSegmentOption(value: 'Full Paid', label: 'Full Paid'),
              PfSegmentOption(value: 'Unpaid', label: 'Unpaid'),
              PfSegmentOption(value: 'Incomplete', label: 'Incomplete'),
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
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                _SummaryField(
                  label: 'Customer',
                  controller: _customerNameCtrl,
                  placeholder: '—',
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
                  placeholder: '—',
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
        border: Border(top: BorderSide(color: AppTheme.surfaceContainer)),
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
                      label: _isSubmitting ? 'Creating…' : 'Create Order',
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
            color: isSelected ? AppTheme.primary : AppTheme.surfaceContainer,
            width: 2,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isSelected)
              Icon(Icons.check_rounded, size: 16, color: AppTheme.onPrimary),
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
          width: 36,
          height: 36,
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
                ? Icon(Icons.check_rounded, size: 18, color: Colors.white)
                : Icon(icon, size: 18, color: isActive ? Colors.white : AppTheme.onSurfaceVariant),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
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
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

/// A summary row that subscribes to a [TextEditingController] via
/// [ValueListenableBuilder], so the value updates live as the user types
/// in the Customer or Details steps — even when the Schedule page was
/// built earlier and is now off-screen in a [PageView].
class _SummaryField extends StatelessWidget {
  const _SummaryField({
    required this.label,
    this.controller,
    this.value,
    this.prefix = '',
    this.placeholder = '—',
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
                'AI, PDF, JPG, PNG • Max 10MB',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.onSurfaceVariant,
                ),
              ),
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
                        size: 18,
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

  Future<void> _pickFile() async {
    // In a real app, use file_picker or image_picker.
    // For frontend mock, just simulate with a dialog.
    final fileName = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Select Layout File'),
        content: const Text('File picker would open here. Enter a mock file name:'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final name = 'design_${DateTime.now().millisecondsSinceEpoch}.ai';
              Navigator.pop(context, name);
            },
            child: const Text('Mock Pick'),
          ),
        ],
      ),
    );

    if (fileName != null && mounted) {
      widget.onFileSelected(fileName);
    }
  }
}