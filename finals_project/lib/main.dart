import 'package:flutter/material.dart';

void main() => runApp(const PrintFlowApp());

// ---------- THEME (Stitch-matched: Segoe UI via system, primary #00535b) ----------
const kPrimary = Color(0xFF00535B);
const kBg = Color(0xFFFBF9F4);
const kSurface = Colors.white;
const kContainer = Color(0xFFF0EEE9);

// ---------- MOCK DATA (mirrors web mockData.ts logic) ----------
final today = DateTime.utc(2026, 8, 20);
String _addDays(String dateStr, int days) {
  final d = DateTime.parse('${dateStr}T00:00:00Z').add(Duration(days: days));
  return "${d.year.toString().padLeft(4,'0')}-${d.month.toString().padLeft(2,'0')}-${d.day.toString().padLeft(2,'0')}";
}
int _diffDays(String target) => DateTime.parse('${target}T00:00:00Z').difference(today).inDays;
String _priority(String target) {
  final d = _diffDays(target);
  if (d < 0) return "Overdue";
  if (d <= 2) return "Urgent";
  return "Upcoming";
}
class Order {
  String orderId, customerName, customerEmail, customerPhone, itemType, layoutFile, targetDate, status, priority, estimatedCompletion;
  int quantity; double paymentAmount; String paymentStatus;
  List<String> basedOn;
  Order({required this.orderId, required this.customerName, this.customerEmail='', this.customerPhone='', required this.itemType, required this.quantity, required this.layoutFile, required this.targetDate, required this.paymentAmount, this.paymentStatus='Unpaid', required this.status, required this.priority, required this.estimatedCompletion, this.basedOn=const []});
}
class Inv {
  String variantId, itemType, category, tagUid, sensorId, status, model; int stock, threshold, rop, forecast; bool isStale;
  Inv({required this.variantId, required this.itemType, required this.category, required this.tagUid, this.sensorId='ESP32-01', required this.stock, required this.threshold, required this.rop, required this.forecast, this.model='Holt-Winters', required this.status, this.isStale=false});
}
List<Order> mockOrders = [
  Order(orderId:"ORD-1023",customerName:"Juan Dela Cruz",customerEmail:"juan.delacruz@gmail.com",customerPhone:"0917-123-4567",itemType:"T-shirt Printing",quantity:20,layoutFile:"layout01.png",targetDate:"2026-08-14",paymentAmount:1500,paymentStatus:"Unpaid",status:"Pending",priority:_priority("2026-08-14"),estimatedCompletion:_addDays("2026-08-14",2),basedOn:["backlog","job_complexity","capacity"]),
  Order(orderId:"ORD-1024",customerName:"Acme Corporation",customerEmail:"orders@acme.com",customerPhone:"0918-234-5678",itemType:"Tarpaulin - Medium",quantity:5,layoutFile:"layout02.png",targetDate:"2026-08-20",paymentAmount:2500,paymentStatus:"Partial",status:"In Production",priority:_priority("2026-08-20"),estimatedCompletion:_addDays("2026-08-20",1),basedOn:["backlog","capacity"]),
  Order(orderId:"ORD-1025",customerName:"Global Logistics",customerEmail:"procurement@globallogistics.ph",customerPhone:"0919-345-6789",itemType:"Tarpaulin - Large",quantity:10,layoutFile:"layout03.png",targetDate:"2026-08-25",paymentAmount:4500,paymentStatus:"Paid",status:"Pending",priority:_priority("2026-08-25"),estimatedCompletion:_addDays("2026-08-25",2),basedOn:["job_complexity","capacity"]),
  Order(orderId:"PF-2024-001",customerName:"Acme Corporation",customerEmail:"orders@acme.com",customerPhone:"0918-234-5678",itemType:"Tarpaulin - Small",quantity:5000,layoutFile:"business-cards-premium.png",targetDate:"2026-08-15",paymentAmount:3500,paymentStatus:"Paid",status:"Completed",priority:_priority("2026-08-15"),estimatedCompletion:_addDays("2026-08-15",2),basedOn:["backlog","job_complexity","capacity"]),
  Order(orderId:"PF-2024-002",customerName:"TechStart Inc",customerEmail:"hello@techstart.ph",customerPhone:"0920-456-7890",itemType:"Paper - A4 80gsm",quantity:2000,layoutFile:"brochure-trifold.png",targetDate:"2026-08-20",paymentAmount:2200,paymentStatus:"Unpaid",status:"In Production",priority:_priority("2026-08-20"),estimatedCompletion:_addDays("2026-08-20",1),basedOn:["backlog","capacity"]),
];
List<Inv> mockInv = [
  Inv(variantId:"TARP-SMALL",itemType:"Tarpaulin - Small",category:"Tarpaulin",tagUid:"04A3B2C1",stock:12,threshold:5,rop:6,forecast:9,status:"In Stock"),
  Inv(variantId:"TARP-MED",itemType:"Tarpaulin - Medium",category:"Tarpaulin",tagUid:"04A3B2C2",stock:2,threshold:5,rop:4,forecast:9,status:"Insufficient Stock"),
  Inv(variantId:"TARP-LARGE",itemType:"Tarpaulin - Large",category:"Tarpaulin",tagUid:"04A3B2C3",stock:4,threshold:5,rop:5,forecast:7,status:"Low Stock",isStale:true),
  Inv(variantId:"MUG-WHITE-11OZ",itemType:"Mug - White 11oz",category:"Mug",tagUid:"04A3B2E1",stock:3,threshold:10,rop:12,forecast:15,status:"Insufficient Stock"),
  Inv(variantId:"PAPER-A4-80GSM",itemType:"Paper - A4 80gsm",category:"Paper",tagUid:"04A3B2G1",stock:120,threshold:50,rop:60,forecast:45,status:"In Stock"),
];

// ---------- APP ----------
class PrintFlowApp extends StatelessWidget {
  const PrintFlowApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PrintFlow',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: kBg,
        colorScheme: ColorScheme.fromSeed(seedColor: kPrimary, primary: kPrimary),
        useMaterial3: true,
        fontFamily: 'Segoe UI',
        appBarTheme: const AppBarTheme(backgroundColor: kSurface, foregroundColor: Color(0xFF1B1C19), elevation: 0),
        cardTheme: CardThemeData(color: kSurface, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFBEC8CA)))),
      ),
      home: const LoginScreen(),
    );
  }
}

// ---------- LOGIN (3 roles only per PDF VI) ----------
class LoginScreen extends StatefulWidget { const LoginScreen({super.key}); @override State<LoginScreen> createState()=> _LoginState(); }
class _LoginState extends State<LoginScreen> {
  String role='POS_Cashier'; final userCtrl=TextEditingController(text:'cashier01'); final passCtrl=TextEditingController(text:'****');
  @override Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 420), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const SizedBox(height: 32),
        Container(width:56,height:56,decoration:BoxDecoration(color:kPrimary,borderRadius: BorderRadius.circular(12)),child: const Icon(Icons.print,color:Colors.white,size:28)),
        const SizedBox(height:16),
        const Text('PrintFlow', style: TextStyle(fontSize:28, fontWeight: FontWeight.bold, color: Color(0xFF1B1C19))),
        const Text('Brialyns Art Sign • Role-based access', style: TextStyle(color: Color(0xFF3E494A))),
        const SizedBox(height:32),
        TextField(controller: userCtrl, decoration: _dec('Username', Icons.person)),
        const SizedBox(height:12),
        TextField(controller: passCtrl, obscureText: true, decoration: _dec('Password', Icons.lock)),
        const SizedBox(height:12),
        DropdownButtonFormField<String>(initialValue: role, decoration: _dec('Role (3 only)', Icons.shield), items: const [
          DropdownMenuItem(value:'Admin', child: Text('Admin')),
          DropdownMenuItem(value:'POS_Cashier', child: Text('POS/Cashier')),
          DropdownMenuItem(value:'Production Staff', child: Text('Production Staff')),
        ], onChanged: (v)=> setState(()=> role=v!)),
        const SizedBox(height:24),
        FilledButton(onPressed: (){
          // POST /api/auth/login {username, password, role}
          Navigator.pushReplacement(context, MaterialPageRoute(builder: (_)=> HomeScreen(role: role)));
        }, style: FilledButton.styleFrom(backgroundColor:kPrimary, padding: const EdgeInsets.symmetric(vertical:16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))), child: const Text('Sign in', style: TextStyle(fontWeight: FontWeight.w600))),
        const SizedBox(height:12),
        const Text('3 roles only • Firebase Auth (mock)', textAlign: TextAlign.center, style: TextStyle(fontSize:12, color: Color(0xFF3E494A))),
      ])))) ;
     );
   }
  InputDecoration _dec(String label, IconData icon)=> InputDecoration(
    labelText: label, prefixIcon: Icon(icon, size:18, color: const Color(0xFF3E494A)),
    filled: true, fillColor: kContainer, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFBEC8CA))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: const Color(0xFFBEC8CA).withValues(alpha:0.4))),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kPrimary, width:1.2)),
    contentPadding: const EdgeInsets.symmetric(horizontal:12, vertical:14),
  );
}

// ---------- HOME with bottom nav ----------
class HomeScreen extends StatefulWidget { final String role; const HomeScreen({super.key, required this.role}); @override State<HomeScreen> createState()=> _HomeState(); }
class _HomeState extends State<HomeScreen> {
  int idx=0;
  @override void initState(){ super.initState(); idx = widget.role=='Production Staff' ? 1 : 0; }
  @override Widget build(BuildContext context) {
    final tabs = [const POSScreen(), const ProductionScreen(), const InventoryScreen()];
    return Scaffold(
      appBar: AppBar(title: Text(widget.role=='Admin' ? 'PrintFlow Admin' : widget.role=='POS_Cashier' ? 'POS / Cashier' : 'Production'), actions: [
        IconButton(icon: const Icon(Icons.logout, size:20), onPressed: ()=> Navigator.pushReplacement(context, MaterialPageRoute(builder: (_)=> const LoginScreen()))),
      ]),
      body: tabs[idx],
      bottomNavigationBar: NavigationBar(selectedIndex: idx, onDestinationSelected: (i)=> setState(()=> idx=i), destinations: const [
        NavigationDestination(icon: Icon(Icons.point_of_sale), label: 'POS'),
        NavigationDestination(icon: Icon(Icons.factory), label: 'Queue'),
        NavigationDestination(icon: Icon(Icons.inventory_2), label: 'Stock'),
      ]),
    );
  }
}

// ---------- POS: Create Order (Objective 1) ----------
class POSScreen extends StatefulWidget { const POSScreen({super.key}); @override State<POSScreen> createState()=> _POSState(); }
class _POSState extends State<POSScreen> {
  final nameCtrl=TextEditingController(), emailCtrl=TextEditingController(), phoneCtrl=TextEditingController(), qtyCtrl=TextEditingController(text:'10'), layoutCtrl=TextEditingController(text:'layout01.png'), paymentCtrl=TextEditingController(text:'1500');
  String itemType='Tarpaulin - Medium'; String targetDate='2026-08-20';
  Future<void> _pickDate() async {
    final d= await showDatePicker(context: context, initialDate: DateTime.parse('${targetDate}T00:00:00Z'), firstDate: DateTime(2026,1,1), lastDate: DateTime(2026,12,31));
    if(d!=null) setState(()=> targetDate="${d.year.toString().padLeft(4,'0')}-${d.month.toString().padLeft(2,'0')}-${d.day.toString().padLeft(2,'0')}");
  }
  @override Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Create Order', style: TextStyle(fontWeight: FontWeight.bold, fontSize:18)),
      const Text('POST /api/orders {customer_name,item_type,quantity,layout_file,target_date,payment_amount}', style: TextStyle(fontSize:11, color: Color(0xFF3E494A))),
      const SizedBox(height:16),
      _field('Customer Name', nameCtrl, Icons.person),
      const SizedBox(height:12),
      Row(children: [Expanded(child:_field('Email', emailCtrl, Icons.email)), const SizedBox(width:12), Expanded(child:_field('Phone', phoneCtrl, Icons.phone))]),
      const SizedBox(height:12),
      DropdownButtonFormField<String>(initialValue:itemType, decoration: _dec2('Item Type', Icons.category), items: const [
        DropdownMenuItem(value:'T-shirt Printing', child: Text('T-shirt Printing')),
        DropdownMenuItem(value:'Tarpaulin - Medium', child: Text('Tarpaulin - Medium')),
        DropdownMenuItem(value:'Tarpaulin - Large', child: Text('Tarpaulin - Large')),
        DropdownMenuItem(value:'Mug - White 11oz', child: Text('Mug - White 11oz')),
        DropdownMenuItem(value:'Paper - A4 80gsm', child: Text('Paper - A4 80gsm')),
      ], onChanged: (v)=> setState(()=> itemType=v!)),
      const SizedBox(height:12),
      Row(children: [Expanded(child:_field('Quantity', qtyCtrl, Icons.numbers, isNum:true)), const SizedBox(width:12), Expanded(child:_field('Layout File', layoutCtrl, Icons.image))]),
      const SizedBox(height:12),
      InkWell(onTap:_pickDate, child: InputDecorator(decoration: _dec2('Target Date', Icons.calendar_today), child: Text(targetDate, style: const TextStyle(fontSize:14)))),
      const SizedBox(height:12),
      _field('Payment Amount', paymentCtrl, Icons.payments, isNum:true),
      const SizedBox(height:16),
      // Inventory check preview (VII first outcome)
      _stockPreview(),
      const SizedBox(height:16),
      FilledButton(onPressed: _createOrder, style: FilledButton.styleFrom(backgroundColor:kPrimary, padding: const EdgeInsets.symmetric(vertical:16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))), child: const Text('Create Order')),
    ]);
  }
  Widget _stockPreview(){
    final inv = mockInv.firstWhere((e)=> itemType.toLowerCase().contains(e.category.toLowerCase()), orElse: ()=> mockInv.first);
    final ok = inv.stock > 5;
    return Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: ok? const Color(0xFFDCECC8): const Color(0xFFFFDAD6), borderRadius: BorderRadius.circular(12), border: Border.all(color: ok? const Color(0xFF2E7D32): const Color(0xFFBA1A1A), width:0.6)),
      child: Row(children: [
        Icon(ok? Icons.check_circle: Icons.warning, color: ok? const Color(0xFF2E7D32): const Color(0xFFBA1A1A), size:18),
        const SizedBox(width:8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(ok? 'Stock available':'Insufficient Stock', style: TextStyle(fontWeight: FontWeight.w600, color: ok? const Color(0xFF2E7D32): const Color(0xFFBA1A1A), fontSize:12)),
          Text('${inv.variantId} Stock ${inv.stock} • ROP ${inv.rop} • Forecast 7d ${inv.forecast}', style: const TextStyle(fontSize:11, color: Color(0xFF3E494A))),
        ])),
      ]));
  }
  void _createOrder(){
    final priority=_priority(targetDate);
    final eta=_addDays(targetDate, priority=='Urgent'?1:2);
    final id='ORD-${DateTime.now().millisecondsSinceEpoch%100000}';
    mockOrders.insert(0, Order(orderId:id, customerName: nameCtrl.text.isEmpty?'Juan Dela Cruz':nameCtrl.text, customerEmail: emailCtrl.text, customerPhone: phoneCtrl.text, itemType:itemType, quantity:int.tryParse(qtyCtrl.text)??10, layoutFile:layoutCtrl.text, targetDate:targetDate, paymentAmount: double.tryParse(paymentCtrl.text)??1500, status:'Pending', priority:priority, estimatedCompletion:eta, basedOn: priority=='Overdue'?['backlog','job_complexity','capacity']:['backlog','capacity']));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Order $id created • Priority $priority • ETA $eta'), backgroundColor: kPrimary));
    setState(()=> {});
  }
  InputDecoration _dec2(String label, IconData icon)=> InputDecoration(
    labelText: label, prefixIcon: Icon(icon, size:18, color: const Color(0xFF3E494A)),
    filled: true, fillColor: kContainer, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: const Color(0xFFBEC8CA).withValues(alpha:0.4))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: const Color(0xFFBEC8CA).withValues(alpha:0.4))), focusedBorder: const OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12)), borderSide: BorderSide(color: kPrimary)),
    contentPadding: const EdgeInsets.symmetric(horizontal:12, vertical:14),
  );
  Widget _field(String label, TextEditingController c, IconData icon, {bool isNum=false})=> TextField(controller:c, keyboardType: isNum? TextInputType.number: null, decoration: _dec2(label, icon));
}

// ---------- PRODUCTION: Queue + ETA (Objectives 2,3,9) ----------
class ProductionScreen extends StatefulWidget { const ProductionScreen({super.key}); @override State<ProductionScreen> createState()=> _ProdState(); }
class _ProdState extends State<ProductionScreen> {
  String filter='All';
  @override Widget build(BuildContext context){
    const rank={'Overdue':0,'Urgent':1,'Upcoming':2};
    List<Order> list = mockOrders.where((o)=> o.status!='Completed').toList();
    list.sort((a,b)=> rank[a.priority]!.compareTo(rank[b.priority]!));
    if(filter!='All') list = list.where((o)=> o.priority==filter).toList();
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(16,12,16,0), child: SegmentedButton<String>(segments: [
        ButtonSegment(value:'All', label: Text('All ${mockOrders.where((o)=>o.status!='Completed').length}')), ButtonSegment(value:'Overdue', label: Text('Overdue ${mockOrders.where((o)=>o.priority=='Overdue' && o.status!='Completed').length}')),
        ButtonSegment(value:'Urgent', label: Text('Urgent ${mockOrders.where((o)=>o.priority=='Urgent' && o.status!='Completed').length}')), ButtonSegment(value:'Upcoming', label: Text('Upcoming ${mockOrders.where((o)=>o.priority=='Upcoming' && o.status!='Completed').length}')),
      ], selected: {filter}, onSelectionChanged: (s)=> setState(()=> filter=s.first))),
      const SizedBox(height:8),
      Expanded(child: ListView.separated(padding: const EdgeInsets.all(16), itemCount: list.length, separatorBuilder: (_,__)=> const SizedBox(height:12), itemBuilder: (_,i){
        final o=list[i];
        return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(o.orderId, style: const TextStyle(fontFamily:'monospace', fontWeight: FontWeight.bold, fontSize:12))),
            Container(padding: const EdgeInsets.symmetric(horizontal:8, vertical:4), decoration: BoxDecoration(color: o.priority=='Overdue'? const Color(0xFFFFDAD6): o.priority=='Urgent'? const Color(0xFFFFF3E0): const Color(0xFF9FF0FB).withValues(alpha:0.3), borderRadius: BorderRadius.circular(20)), child: Text(o.priority, style: const TextStyle(fontSize:11, fontWeight: FontWeight.w600))),
            const SizedBox(width:8),
            Container(padding: const EdgeInsets.symmetric(horizontal:8, vertical:4), decoration: BoxDecoration(color: const Color(0xFFDCECC8), borderRadius: BorderRadius.circular(20)), child: Text(o.status, style: const TextStyle(fontSize:11))),
          ]),
          const SizedBox(height:8),
          Text('${o.customerName} • ${o.itemType} ×${o.quantity}', style: const TextStyle(fontSize:13, fontWeight: FontWeight.w500)),
          Text('Target ${o.targetDate} • ETA ${o.estimatedCompletion} • via ${o.basedOn.join(', ')}', style: const TextStyle(fontSize:11, color: Color(0xFF3E494A))),
          const SizedBox(height:10),
          Wrap(spacing:8, children: [
            if(o.status=='Pending') FilledButton.tonal(onPressed: ()=> _update(o,'In Production'), child: const Text('Start Production')),
            if(o.status=='In Production') FilledButton(onPressed: ()=> _update(o,'Ready for Pickup'), child: const Text('Mark Ready')),
            if(o.status=='Ready for Pickup') FilledButton(onPressed: ()=> _update(o,'Completed'), style: FilledButton.styleFrom(backgroundColor: const Color(0xFF2E7D32)), child: const Text('Complete')),
            OutlinedButton(onPressed: ()=> _showLayout(o), child: const Text('View Layout')),
          ]),
        ])),
       ),
     ]);
  }
  void _update(Order o, String next){
    setState(()=> o.status=next);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${o.orderId} → $next'), backgroundColor: kPrimary));
    // PUT /api/orders/{id}/status + GET /api/orders/{id}/eta would recalc here (VII)
  }
  void _showLayout(Order o){
    showDialog(context: context, builder: (_)=> AlertDialog(title: Text(o.layoutFile), content: Container(height:120, color: kContainer, child: const Center(child: Icon(Icons.image, size:48, color: Color(0xFF3E494A)))), actions: [TextButton(onPressed: ()=> Navigator.pop(context), child: const Text('Close'))]));
  }
}

// ---------- INVENTORY + RFID preview (Objectives 4,7,8) ----------
class InventoryScreen extends StatelessWidget {
  const InventoryScreen({super.key});
  @override Widget build(BuildContext context){
    return ListView(padding: const EdgeInsets.all(16), children: [
      GridView.count(crossAxisCount:2, shrinkWrap:true, physics: const NeverScrollableScrollPhysics(), crossAxisSpacing:12, mainAxisSpacing:12, childAspectRatio:1.4, children: [
        _kpi('Total Variants','${mockInv.length}', Icons.inventory_2, 'all variants'),
        _kpi('Need Reorder','${mockInv.where((i)=> i.stock<=i.rop).length}', Icons.warning, 'below ROP'),
        _kpi('Insufficient','${mockInv.where((i)=> i.status=='Insufficient Stock').length}', Icons.error, 'urgent'),
        _kpi('Holt-Winters','7 days', Icons.trending_up, 'forecast model'),
      ]),
      const SizedBox(height:16),
      Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('RFID Checkout Source (POST /api/rfid/checkout)', style: TextStyle(fontWeight: FontWeight.bold, fontSize:12)),
        const SizedBox(height:6),
        Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: kContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFBEC8CA))), child: const Text('Each tap = {material_variant_id, tag_uid, sensor_id: ESP32-01, timestamp} → -1 unit, debounce prevents duplicate.', style: TextStyle(fontFamily:'monospace', fontSize:11))),
        const SizedBox(height:6),
        const Text('• One tag per variant (TARP-MED, INK-BLACK) whole-unit only\n• Offline cached syncs when ESP32 reconnects\n• Example: TARP-MED stock 2 • ROP 4 → reorder alert', style: TextStyle(fontSize:11, color: Color(0xFF3E494A))),
        const SizedBox(height:8),
        FilledButton.tonal(onPressed: (){
          // mock tap: deduct 1 from TARP-MED
          final t = mockInv.firstWhere((e)=> e.variantId=='TARP-MED');
          t.stock = (t.stock-1).clamp(0, 999);
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Tapped ${t.variantId} ${t.tagUid} → stock ${t.stock} (POST /api/rfid/checkout)'), backgroundColor: kPrimary));
        }, child: const Text('Mock Tap TARP-MED')),
      ]))),
      const SizedBox(height:12),
      ...mockInv.map((i)=> Card(child: ListTile(
        leading: CircleAvatar(backgroundColor: i.status=='In Stock'? const Color(0xFFDCECC8): i.status=='Low Stock'? const Color(0xFFFFF3E0): const Color(0xFFFFDAD6), child: Icon(i.isStale? Icons.sync_problem: Icons.inventory_2, size:18, color: i.status=='In Stock'? const Color(0xFF2E7D32): const Color(0xFFBA1A1A))),
        title: Text('${i.variantId} • ${i.itemType}', style: const TextStyle(fontSize:12, fontWeight: FontWeight.bold)),
        subtitle: Text('Stock ${i.stock} / ROP ${i.rop} • Forecast 7d ${i.forecast} (${i.model}) • ${i.tagUid} ${i.sensorId}${i.isStale?' • STALE':''}', style: const TextStyle(fontSize:11)),
        trailing: Container(padding: const EdgeInsets.symmetric(horizontal:8, vertical:4), decoration: BoxDecoration(color: i.status=='In Stock'? const Color(0xFFDCECC8): const Color(0xFFFFDAD6), borderRadius: BorderRadius.circular(20)), child: Text(i.status, style: const TextStyle(fontSize:10))),
      ))),
    ]);
  }
  Widget _kpi(String label, String value, IconData icon, String sub)=> Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Row(children: [Expanded(child: Text(label, style: const TextStyle(fontSize:11, color: Color(0xFF3E494A)))), Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFF9FF0FB).withValues(alpha:0.3), borderRadius: BorderRadius.circular(8)), child: Icon(icon, size:16, color: kPrimary))]),
    Text(value, style: const TextStyle(fontSize:22, fontWeight: FontWeight.bold)),
    Text(sub, style: const TextStyle(fontSize:11, color: Color(0xFF3E494A))),
  ])));
}
