import 'package:flutter_test/flutter_test.dart';
import 'package:finals_project/main.dart';

void main() {
  testWidgets('PrintFlow loads', (WidgetTester tester) async {
    await tester.pumpWidget(const PrintFlowApp());
    expect(find.text('PrintFlow'), findsOneWidget);
  });
}
