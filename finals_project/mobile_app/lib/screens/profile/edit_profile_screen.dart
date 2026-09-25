import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../models/user_address.dart';
import '../../services/audit_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/chrome.dart';
import '../../widgets/address_cascade.dart';

/// Edit the signed-in user's own profile: full name + PSGC address.
///
/// Opened ONLY after the Profile screen's OTP gate verified the account's
/// registered email. Writes `users/{uid}` (self-update is allowed by the
/// rules) and records a `profile_updated` audit entry. The registered
/// email itself is not editable here - it is the account identity.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final TextEditingController _nameCtrl = TextEditingController();
  UserAddress _address = const UserAddress();
  bool _initialized = false;
  bool _saving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    // AuthProvider is an inherited widget - read it here (not in
    // initState) and only once so later rebuilds keep the user's edits.
    final user = AuthProvider.of(context).currentUser;
    _nameCtrl.text = user?.name ?? '';
    _address = UserAddress(
      region: user?.region,
      province: user?.province,
      city: user?.city,
      barangay: user?.barangay,
      zip: user?.zip,
    );
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final auth = AuthProvider.of(context);
    final uid = auth.currentUid;
    final name = _nameCtrl.text.trim();
    if (uid == null) return;
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your full name.')),
      );
      return;
    }
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final previousName = auth.currentUser?.name ?? '';
    try {
      await FirebaseFirestore.instance.collection('users').doc(uid).set(
        <String, dynamic>{
          'name': name,
          'address': _address.toJson(),
          'updated_at': FieldValue.serverTimestamp(),
        },
        SetOptions(merge: true),
      );
      AuditService.log(
        actor: auth.currentUser,
        action: 'profile_updated',
        module: 'users',
        recordId: uid,
        recordLabel: 'Profile $name',
        oldValue: previousName.isEmpty ? null : previousName,
        newValue: name,
      );
      if (!mounted) return;
      navigator.pop(true);
    } catch (e) {
      debugPrint('[edit-profile] save failed: $e');
      if (!mounted) return;
      setState(() => _saving = false);
      messenger.showSnackBar(
        SnackBar(
          content: const Text('Could not save your profile. Try again.'),
          backgroundColor: AppTheme.statusUrgent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);
    final email = auth.currentUser?.email ?? '-';

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Edit profile'),
        backgroundColor: chromeBarBackground(context),
        foregroundColor: chromeBarForeground(context),
        systemOverlayStyle: chromeBarOverlay(context),
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          children: [
            // The OTP gate already proved inbox access - show what was
            // confirmed instead of letting the email be edited here.
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppTheme.successContainer,
                borderRadius: AppRadius.rMd,
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.verified_outlined,
                    size: AppIconSize.sm,
                    color: AppTheme.success,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Email confirmed - $email',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.onSurface,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            PfTextField(
              label: 'Full name',
              controller: _nameCtrl,
              prefixIcon: Icons.person_outline_rounded,
              textInputAction: TextInputAction.done,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Address',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: AppTheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: AppSpacing.sm),
            AddressCascade(
              value: _address,
              onChange: (v) => setState(() => _address = v),
            ),
            const SizedBox(height: AppSpacing.xl),
            PfButton.filled(
              label: 'Save changes',
              icon: Icons.check_rounded,
              fullWidth: true,
              loading: _saving,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
