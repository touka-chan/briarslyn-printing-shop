/// Mirrors the web `Order` interface in `web/src/types/index.ts`.
/// Aligned to Title 1 IX. API Contract: /api/orders, /api/orders/queue,
/// /api/orders/{id}/status, /api/orders/{id}/eta.
class Order {
  final String orderId;
  final String customerName;
  final String? customerEmail;
  final String? customerPhone;
  final String itemType;
  final int quantity;
  final String layoutFile;
  final DateTime targetDate;
  final double paymentAmount;
  final String? paymentStatus; // 'Paid' | 'Full Paid' | 'Unpaid' | 'Incomplete'
  final String status; // 'Pending' | 'In Production' | 'Ready for Pickup' | 'Completed'
  final String priority; // 'Overdue' | 'Urgent' | 'Upcoming'
  final DateTime estimatedCompletion;
  final List<String>? basedOn; // 'backlog' | 'job_complexity' | 'capacity'
  final DateTime? createdAt;

  const Order({
    required this.orderId,
    required this.customerName,
    this.customerEmail,
    this.customerPhone,
    required this.itemType,
    required this.quantity,
    required this.layoutFile,
    required this.targetDate,
    required this.paymentAmount,
    this.paymentStatus,
    required this.status,
    required this.priority,
    required this.estimatedCompletion,
    this.basedOn,
    this.createdAt,
  });

  /// Sample/mock data — matches `web/src/lib/mockData.ts` for parity.
  factory Order.fromJson(Map<String, dynamic> json) => Order(
        orderId: json['order_id'] as String,
        customerName: json['customer_name'] as String,
        customerEmail: json['customer_email'] as String?,
        customerPhone: json['customer_phone'] as String?,
        itemType: json['item_type'] as String,
        quantity: json['quantity'] as int,
        layoutFile: json['layout_file'] as String,
        targetDate: DateTime.parse(json['target_date'] as String),
        paymentAmount: (json['payment_amount'] as num).toDouble(),
        paymentStatus: json['payment_status'] as String?,
        status: json['status'] as String,
        priority: json['priority'] as String,
        estimatedCompletion: DateTime.parse(json['estimated_completion'] as String),
        basedOn: (json['based_on'] as List?)?.cast<String>(),
        createdAt: json['createdAt'] != null
            ? DateTime.parse(json['createdAt'] as String)
            : null,
      );

  Map<String, dynamic> toJson() => {
        'order_id': orderId,
        'customer_name': customerName,
        'customer_email': customerEmail,
        'customer_phone': customerPhone,
        'item_type': itemType,
        'quantity': quantity,
        'layout_file': layoutFile,
        'target_date': targetDate.toIso8601String().split('T').first,
        'payment_amount': paymentAmount,
        'payment_status': paymentStatus,
        'status': status,
        'priority': priority,
        'estimated_completion': estimatedCompletion.toIso8601String().split('T').first,
        'based_on': basedOn,
        'createdAt': createdAt?.toIso8601String().split('T').first,
      };
}
