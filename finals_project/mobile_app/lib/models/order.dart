/// One material line pinned to an order at creation: the BOM recipe scaled
/// to the order quantity (rounded up, like the deduct engine), editable
/// while the order is Pending. Mirrors the web `Order["materials"]` shape.
class OrderMaterial {
  /// Inventory variant consumed by the order.
  final String materialVariantId;

  /// Whole units needed for THIS order.
  final int qty;

  const OrderMaterial({required this.materialVariantId, required this.qty});

  factory OrderMaterial.fromJson(Map<String, dynamic> json) => OrderMaterial(
        materialVariantId: json['material_variant_id'] as String,
        qty: (json['qty'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'material_variant_id': materialVariantId,
        'qty': qty,
      };
}

/// Mirrors the web `Order` interface in `web/src/types/index.ts`.
/// Aligned to Title 1 IX. API Contract: /api/orders, /api/orders/queue,
/// /api/orders/{id}/status, /api/orders/{id}/eta.
///
/// `customerRegion` / `customerProvince` / `customerCity` / `customerBarangay`
/// / `customerZip` carry the PSGC cascade output captured at order entry on
/// the POS Cashier's New Order screen. All five are optional so legacy
/// orders and orders entered without an address still round-trip cleanly.
class Order {
  final String orderId;
  final String customerName;
  final String? customerEmail;
  final String? customerPhone;
  final String? customerRegion;
  final String? customerProvince;
  final String? customerCity;
  final String? customerBarangay;
  final String? customerZip;
  final String itemType;
  final int quantity;
  final String layoutFile;
  final DateTime targetDate;
  final double paymentAmount;
  /// Canonical POS terms: 'Unpaid' | 'Partially Paid' | 'Paid'.
  /// Legacy values ('Full Paid', 'Incomplete', 'Partial') still parse.
  final String? paymentStatus;
  final String? paymentMethod; // 'Cash' | 'E-Wallets' | 'Bank Transfer'
  final String status; // 'Pending' | 'In Production' | 'Ready for Pickup' | 'Completed'
  final String priority; // 'Overdue' | 'Urgent' | 'Upcoming'
  final DateTime estimatedCompletion;
  final List<String>? basedOn; // 'backlog' | 'job_complexity' | 'capacity'
  final String? cashierId; // Firebase Auth uid of the cashier who created the order
  final DateTime? createdAt;
  /// True once the recipe was auto-deducted (order entered production).
  final bool stockDeducted;
  /// Per-order materials snapshot: pinned at creation from the BOM recipe
  /// scaled to the order quantity (editable while the order is Pending).
  /// Empty on legacy orders - the auto-deduct then falls back to the BOM.
  final List<OrderMaterial> materials;
  /// Stamped when the order enters production / completes (ETA throughput).
  final DateTime? startedAt;
  final DateTime? completedAt;

  const Order({
    required this.orderId,
    required this.customerName,
    this.customerEmail,
    this.customerPhone,
    this.customerRegion,
    this.customerProvince,
    this.customerCity,
    this.customerBarangay,
    this.customerZip,
    required this.itemType,
    required this.quantity,
    required this.layoutFile,
    required this.targetDate,
    required this.paymentAmount,
    this.paymentStatus,
    this.paymentMethod,
    required this.status,
    required this.priority,
    required this.estimatedCompletion,
    this.basedOn,
    this.cashierId,
    this.createdAt,
    this.stockDeducted = false,
    this.startedAt,
    this.completedAt,
    this.materials = const [],
  });

  /// Reads the shared Firestore order shape (snake_case, Timestamps).
  factory Order.fromJson(Map<String, dynamic> json) => Order(
        orderId: json['order_id'] as String,
        customerName: json['customer_name'] as String,
        customerEmail: json['customer_email'] as String?,
        customerPhone: json['customer_phone'] as String?,
        customerRegion: json['customer_region'] as String?,
        customerProvince: json['customer_province'] as String?,
        customerCity: json['customer_city'] as String?,
        customerBarangay: json['customer_barangay'] as String?,
        customerZip: json['customer_zip'] as String?,
        itemType: json['item_type'] as String,
        quantity: json['quantity'] as int,
        layoutFile: json['layout_file'] as String,
        targetDate: _requireDate(json['target_date'], 'target_date'),
        paymentAmount: (json['payment_amount'] as num).toDouble(),
        paymentStatus: json['payment_status'] as String?,
        paymentMethod: json['payment_method'] as String?,
        status: json['status'] as String,
        priority: json['priority'] as String,
        estimatedCompletion:
            _requireDate(json['estimated_completion'], 'estimated_completion'),
        basedOn: (json['based_on'] as List?)?.cast<String>(),
        cashierId: json['cashier_id'] as String?,
        createdAt: _parseDate(json['created_at']),
        stockDeducted: json['stock_deducted'] as bool? ?? false,
        startedAt: _parseDate(json['started_at']),
        completedAt: _parseDate(json['completed_at']),
        materials: ((json['materials'] as List?) ?? const [])
            .map((e) =>
                OrderMaterial.fromJson((e as Map).cast<String, dynamic>()))
            .toList(growable: false),
      );

  Map<String, dynamic> toJson() => {
        'order_id': orderId,
        'customer_name': customerName,
        'customer_email': customerEmail,
        'customer_phone': customerPhone,
        'customer_region': customerRegion,
        'customer_province': customerProvince,
        'customer_city': customerCity,
        'customer_barangay': customerBarangay,
        'customer_zip': customerZip,
        'item_type': itemType,
        'quantity': quantity,
        'layout_file': layoutFile,
        'target_date': targetDate.toIso8601String().split('T').first,
        'payment_amount': paymentAmount,
        'payment_status': paymentStatus,
        'payment_method': paymentMethod,
        'status': status,
        'priority': priority,
        'estimated_completion': estimatedCompletion.toIso8601String().split('T').first,
        'based_on': basedOn,
        'cashier_id': cashierId,
        'created_at': createdAt?.toIso8601String().split('T').first,
        'stock_deducted': stockDeducted,
        'started_at': startedAt?.toIso8601String(),
        'completed_at': completedAt?.toIso8601String(),
        'materials': materials.map((m) => m.toJson()).toList(),
      };

  /// Copies the order with the given fields replaced. Nullable fields
  /// cannot be reset to null through this method (by design - callers
  /// only ever set values here).
  Order copyWith({
    String? orderId,
    String? customerName,
    String? customerEmail,
    String? customerPhone,
    String? customerRegion,
    String? customerProvince,
    String? customerCity,
    String? customerBarangay,
    String? customerZip,
    String? itemType,
    int? quantity,
    String? layoutFile,
    DateTime? targetDate,
    double? paymentAmount,
    String? paymentStatus,
    String? paymentMethod,
    String? status,
    String? priority,
    DateTime? estimatedCompletion,
    List<String>? basedOn,
    String? cashierId,
    DateTime? createdAt,
    bool? stockDeducted,
    DateTime? startedAt,
    DateTime? completedAt,
    List<OrderMaterial>? materials,
  }) {
    return Order(
      orderId: orderId ?? this.orderId,
      customerName: customerName ?? this.customerName,
      customerEmail: customerEmail ?? this.customerEmail,
      customerPhone: customerPhone ?? this.customerPhone,
      customerRegion: customerRegion ?? this.customerRegion,
      customerProvince: customerProvince ?? this.customerProvince,
      customerCity: customerCity ?? this.customerCity,
      customerBarangay: customerBarangay ?? this.customerBarangay,
      customerZip: customerZip ?? this.customerZip,
      itemType: itemType ?? this.itemType,
      quantity: quantity ?? this.quantity,
      layoutFile: layoutFile ?? this.layoutFile,
      targetDate: targetDate ?? this.targetDate,
      paymentAmount: paymentAmount ?? this.paymentAmount,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      estimatedCompletion: estimatedCompletion ?? this.estimatedCompletion,
      basedOn: basedOn ?? this.basedOn,
      cashierId: cashierId ?? this.cashierId,
      createdAt: createdAt ?? this.createdAt,
      stockDeducted: stockDeducted ?? this.stockDeducted,
      startedAt: startedAt ?? this.startedAt,
      completedAt: completedAt ?? this.completedAt,
      materials: materials ?? this.materials,
    );
  }
}

/// Parses a Firestore Timestamp, ISO string, or null into a [DateTime].
DateTime? _parseDate(dynamic raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw;
  if (raw is String) return DateTime.parse(raw);
  // Firestore Timestamp: has a toDate() method
  try {
    final dyn = raw as dynamic;
    return dyn.toDate() as DateTime;
  } catch (_) {
    return null;
  }
}

/// Like [_parseDate] but throws a descriptive [FormatException] if the
/// value is missing or unrecognised. Used for required date fields
/// (`target_date`, `estimated_completion`) where a missing or
/// unparseable value is a data error that should surface immediately
/// rather than silently becoming `DateTime.now()` or crashing on an
/// `as String` cast.
DateTime _requireDate(dynamic raw, String fieldName) {
  final parsed = _parseDate(raw);
  if (parsed != null) return parsed;
  throw FormatException(
    'Order.$fieldName is required and must be a Firestore Timestamp, '
    'DateTime, or ISO-8601 string; got ${raw.runtimeType}: $raw',
  );
}
