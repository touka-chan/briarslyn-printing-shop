// PrintFlow Mobile - profile-edit OTP client.
//
// Calls the Apps Script webhook actions "send_otp" / "verify_otp". The
// 6-digit code is generated and stored server-side (Firestore
// `otp_codes/{uid}`, client access denied by rules) by the script's
// service account, emailed to the account's registered address, valid
// for 5 minutes, single-use, max 5 attempts. Possessing the code
// therefore proves access to the registered inbox.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

const String _kWebhookUrl =
    'https://script.google.com/macros/s/AKfycbwHoTUX9sPSS6cK0Z3URJdzyJveDCOSMSBOaDEx9NvHXuz4vMSTKsZvSEPzPbdkenM/exec';

/// Shared secret with the Apps Script (same value the password-reset
/// client uses). Not a hard security boundary - it stops casual abuse of
/// the webhook URL. Codes are single-use and validated server-side.
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

Future<_WebhookReply> _post(Map<String, String> body) async {
  try {
    final res = await http
        .post(
          Uri.parse(_kWebhookUrl),
          headers: {'Content-Type': 'text/plain;charset=utf-8'},
          body: jsonEncode({...body, 'secret': _kWebhookSecret}),
        )
        .timeout(const Duration(seconds: 30));

    // Apps Script answers a POST with a 302 to script.googleusercontent.com
    // carrying the output; Dart's HttpClient does not follow redirects for
    // POST, so follow it manually with a GET (same as the reset client).
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
    debugPrint('[otp] webhook request failed: $e');
    return const _WebhookReply(reachable: false);
  }
}

/// Server error codes -> copy shown in the sheet.
String _friendly(String? error) {
  switch (error) {
    case 'invalid_code':
      return 'That code is incorrect. Check the email and try again.';
    case 'expired':
      return 'That code expired. Send a new one.';
    case 'too_many_tries':
      return 'Too many attempts. Send a new code.';
    case 'no_code':
      return 'No active code for this account. Send a new one.';
    case 'store_failed':
    case 'read_failed':
      return 'The confirmation service had a problem. Try again.';
    case 'unauthorized':
      return 'The confirmation service is misconfigured. Tell the Owner.';
    default:
      return 'Could not complete the confirmation. Try again.';
  }
}

Future<void> _request(Map<String, String> body) async {
  var reply = await _post(body);
  // Apps Script cold starts can answer with a transient error page; one
  // retry keeps the flow reliable. Business errors return valid JSON.
  if (!reply.reachable) {
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    reply = await _post(body);
    if (!reply.reachable) {
      throw Exception(
        'Could not reach the confirmation service. Check your connection and try again.',
      );
    }
  }
  final data = reply.data;
  if (data == null || data['ok'] != true) {
    throw Exception(_friendly(data?['error'] as String?));
  }
}

/// Emails a fresh 6-digit confirmation code to the registered address.
/// Replaces any previous code for the account.
Future<void> sendProfileEditOtp({
  required String uid,
  required String email,
  String name = '',
}) {
  return _request(<String, String>{
    'action': 'send_otp',
    'uid': uid,
    'email': email,
    'name': name,
  });
}

/// Verifies + consumes the code. Completes only when the server accepted
/// the code (valid, unexpired, under the attempt cap).
Future<void> verifyProfileEditOtp({
  required String uid,
  required String code,
}) {
  return _request(<String, String>{
    'action': 'verify_otp',
    'uid': uid,
    'code': code,
  });
}
