// PrintFlow Mobile widget tests.
import 'package:flutter_test/flutter_test.dart';

import 'package:printflow_mobile/main.dart';

void main() {
  testWidgets('PrintFlow app smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const PrintFlowApp());

    // Verify that the login screen is displayed.
    expect(find.text('PrintFlow'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });
}
