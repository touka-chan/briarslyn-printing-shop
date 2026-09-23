// PrintFlow Mobile - password-reset webhook client.
//
// Mirrors the web `web/src/lib/services/password-reset.ts`. The mobile
// app does NOT use Firebase's `sendPasswordResetEmail`: Google
// currently blocks email-template/action-URL updates
// (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`), so the Firebase email can only
// link to its own unbranded handler page. Instead we POST to a Google
// Apps Script webhook (owned by the project Owner) which:
//   1. mints a service-account token and asks the Identity Toolkit
//      Admin API for a reset link (returnOobLink: true),
//   2. extracts the one-time code and builds a direct link to our
//      branded `/reset-password` page,
//   3. emails a branded message (inline logo + personalised greeting)
//      through Gmail.
//
// The webhook URL + secret are the same ones the web app uses.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

const String _kWebhookUrl =
    'https://script.google.com/macros/s/AKfycbwHoTUX9sPSS6cK0Z3URJdzyJveDCOSMSBOaDEx9NvHXuz4vMSTKsZvSEPzPbdkenM/exec';

/// Shared secret with the Apps Script. Not a hard security boundary
/// (the app bundle is inspectable) - it stops casual abuse of the
/// webhook URL. Reset codes are single-use and expire in 1 hour.
const String _kWebhookSecret = 'QlMCpL7iBOIHgtu5wCp84nY9muJvMTr';

class _WebhookReply {
  const _WebhookReply({this.data, required this.reachable});
  final Map<String, dynamic>? data;
  final bool reachable;
}

bool _isRedirect(int code) =>
    code == 301 || code == 302 || code == 303 || code == 307 || code == 308;

_WebhookReply _parse(http.Response res) {
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return const _WebhookReply(reachable: false);
  }
  try {
    final decoded = jsonDecode(res.body);
    if (decoded is Map<String, dynamic>) {
      return _WebhookReply(data: decoded, reachable: true);
    }
    return const _WebhookReply(reachable: false);
  } catch (_) {
    return const _WebhookReply(reachable: false);
  }
}

Future<_WebhookReply> _post(String email, String name) async {
  try {
    final res = await http
        .post(
          Uri.parse(_kWebhookUrl),
          headers: {'Content-Type': 'text/plain;charset=utf-8'},
          body: jsonEncode(<String, String>{
            'email': email,
            'name': name,
            'secret': _kWebhookSecret,
          }),
        )
        .timeout(const Duration(seconds: 30));

    // Apps Script answers a POST with a 302 to script.googleusercontent.com
    // carrying the actual output. Browser fetch follows that redirect
    // automatically; Dart's HttpClient does NOT follow redirects for
    // POST, so we follow it ourselves with a GET.
    if (_isRedirect(res.statusCode)) {
      final location = res.headers['location'];
      if (location == null || location.isEmpty) {
        return const _WebhookReply(reachable: false);
      }
      final followed = await http
          .get(Uri.parse(location))
          .timeout(const Duration(seconds: 30));
      return _parse(followed);
    }

    return _parse(res);
  } catch (e) {
    debugPrint('[password-reset] webhook request failed: $e');
    return const _WebhookReply(reachable: false);
  }
}

/// Asks the Apps Script webhook to email a branded reset link to
/// [email]. Completes when the script confirms it sent the message;
/// throws a human-readable [Exception] otherwise.
///
/// [name] is the requester's full name from the users collection - the
/// script personalises the email greeting with it ("Hi Jena,").
Future<void> requestPasswordReset(String email, {String name = ''}) async {
  var safeName = name.trim();
  if (safeName.length > 80) {
    safeName = safeName.substring(0, 80);
  }

  var reply = await _post(email, safeName);

  // Apps Script cold starts occasionally answer with a transient error
  // page instead of JSON. One retry after a short pause keeps the flow
  // reliable; a genuine failure returns valid JSON and is NOT retried
  // (avoids duplicate emails).
  if (!reply.reachable) {
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    reply = await _post(email, safeName);
    if (!reply.reachable) {
      throw Exception(
        'Could not reach the reset service. Check your connection and try again.',
      );
    }
  }

  final data = reply.data;
  if (data == null || data['ok'] != true) {
    final err = data?['error'];
    throw Exception(
      err is String && err.isNotEmpty
          ? 'Reset service error ($err). Try again in a moment.'
          : 'Could not send the reset email. Try again in a moment.',
    );
  }
}
