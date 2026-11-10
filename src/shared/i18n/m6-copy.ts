import type { SupportedLocale } from '../../domain/types/entities';

export interface M6TranslationCopy {
  preferencesTitle: string;
  thousandsModeLabel: string;
  hideBalancesDefaultLabel: string;
  baseCurrencyLabel: string;
  appLockTitle: string;
  appLockSubtitle: string;
  pinPlaceholder: string;
  setPinBtn: string;
  removePinBtn: string;
  lockNowBtn: string;
  pinSetSuccess: string;
  unlockTitle: string;
  unlockSubtitle: string;
  unlockBtn: string;
  unlockErrorMsg: string;
  privacyBlurTitle: string;
  privacyBlurDesc: string;
  dataPortabilityTitle: string;
  dataPortabilitySubtitle: string;
  exportCsvBtn: string;
  exportJsonBtn: string;
  importJsonLabel: string;
  exportSuccessMsg: string;
  restoreSuccessMsg: string;
  signOutBtn: string;
  deleteAccountTitle: string;
  deleteAccountDesc: string;
  deleteStep1Btn: string;
  deleteStep2Prompt: string;
  deleteConfirmBtn: string;
  cancelBtn: string;
  accountDeletedMsg: string;
  feedbackTitle: string;
  feedbackPlaceholder: string;
  sendFeedbackBtn: string;
  feedbackThanksMsg: string;
  privacyPolicyNote: string;
}

export const M6_COPY: Record<SupportedLocale, M6TranslationCopy> = {
  en: {
    preferencesTitle: 'Input & Display Preferences',
    thousandsModeLabel: 'Quick thousands input (45 → 45.000đ)',
    hideBalancesDefaultLabel: 'Hide balances by default (Privacy Blur active)',
    baseCurrencyLabel: 'Base reporting currency',
    appLockTitle: 'App Privacy Lock (PIN / WebAuthn)',
    appLockSubtitle:
      'Client-side privacy lock (PBKDF2/SHA-256 salted hash). Automatically blurs screen in background.',
    pinPlaceholder: 'Enter 4-6 digit PIN',
    setPinBtn: 'Enable PIN Lock',
    removePinBtn: 'Disable PIN Lock',
    lockNowBtn: 'Lock App Now',
    pinSetSuccess: 'PIN hashed with salt & saved!',
    unlockTitle: 'App Privacy Locked 🔒',
    unlockSubtitle: 'Enter your PIN to view your financial ledger.',
    unlockBtn: 'Unlock',
    unlockErrorMsg: 'Incorrect PIN. Please try again.',
    privacyBlurTitle: 'Privacy Shield Active',
    privacyBlurDesc: 'Balances hidden while app is in background.',
    dataPortabilityTitle: 'Backup, Restore & CSV Export',
    dataPortabilitySubtitle:
      'CSV is protected against formula injection. Full JSON snapshot backs up 100% of local data.',
    exportCsvBtn: 'Export CSV',
    exportJsonBtn: 'Backup Full JSON (.json)',
    importJsonLabel: 'Restore from JSON',
    exportSuccessMsg: 'Data exported!',
    restoreSuccessMsg: 'Full JSON snapshot restored!',
    signOutBtn: 'Check Sign-Out Guard',
    deleteAccountTitle: 'Danger Zone · Permanent Account Deletion',
    deleteAccountDesc:
      'Permanently wipes all local IndexedDB & cloud data. Requires 2-step confirmation.',
    deleteStep1Btn: 'Delete Account & All Data',
    deleteStep2Prompt: 'Type DELETE to permanently erase all data:',
    deleteConfirmBtn: 'Confirm Permanent Erase',
    cancelBtn: 'Cancel',
    accountDeletedMsg: 'All data permanently erased.',
    feedbackTitle: 'Feedback & Privacy Policy',
    feedbackPlaceholder: 'Share a feature idea or bug report...',
    sendFeedbackBtn: 'Send Feedback',
    feedbackThanksMsg: 'Thank you for your feedback! ✨',
    privacyPolicyNote:
      'Zero PII / Financial Leak Policy: Analytics never collect money amounts, notes, or names.',
  },
  vi: {
    preferencesTitle: 'Tùy chọn Nhập liệu & Hiển thị',
    thousandsModeLabel: 'Nhập nhanh hàng nghìn (gõ 45 → 45.000đ)',
    hideBalancesDefaultLabel: 'Ẩn số dư mặc định (kèm làm mờ khi ẩn ứng dụng)',
    baseCurrencyLabel: 'Đồng tiền cơ sở (Base currency)',
    appLockTitle: 'Khóa bảo mật riêng tư (PIN / WebAuthn)',
    appLockSubtitle:
      'Khóa quyền riêng tư phía client (băm PBKDF2/SHA-256 kèm salt). Tự động làm mờ khi chuyển app.',
    pinPlaceholder: 'Nhập mã PIN 4-6 số',
    setPinBtn: 'Bật khóa PIN',
    removePinBtn: 'Tắt khóa PIN',
    lockNowBtn: 'Khóa ứng dụng ngay',
    pinSetSuccess: 'Đã băm mã PIN kèm salt an toàn!',
    unlockTitle: 'Ứng dụng đang khóa bảo mật 🔒',
    unlockSubtitle: 'Nhập mã PIN để mở sổ thu chi của bạn.',
    unlockBtn: 'Mở khóa',
    unlockErrorMsg: 'Mã PIN chưa đúng, vui lòng thử lại.',
    privacyBlurTitle: 'Đang bật màn chắn riêng tư',
    privacyBlurDesc: 'Tự động che số tiền khi chuyển sang màn hình đa nhiệm.',
    dataPortabilityTitle: 'Sao lưu, Khôi phục & Xuất CSV',
    dataPortabilitySubtitle:
      'CSV có chống CSV Injection. Bản sao lưu JSON chứa 100% tài khoản, sổ nợ, định kỳ và giao dịch.',
    exportCsvBtn: 'Xuất file CSV',
    exportJsonBtn: 'Sao lưu toàn bộ (.json)',
    importJsonLabel: 'Khôi phục từ file .json',
    exportSuccessMsg: 'Đã xuất dữ liệu thành công!',
    restoreSuccessMsg: 'Đã khôi phục 100% dữ liệu từ bản sao lưu!',
    signOutBtn: 'Kiểm tra Đăng xuất an toàn',
    deleteAccountTitle: 'Vùng nguy hiểm · Xóa tài khoản vĩnh viễn',
    deleteAccountDesc:
      'Xóa vĩnh viễn toàn bộ dữ liệu trên máy và đám mây (xác nhận 2 bước).',
    deleteStep1Btn: 'Xóa tài khoản vĩnh viễn',
    deleteStep2Prompt: 'Nhập chữ DELETE để xác nhận xóa vĩnh viễn:',
    deleteConfirmBtn: 'Xác nhận xóa vĩnh viễn',
    cancelBtn: 'Hủy',
    accountDeletedMsg: 'Đã xóa vĩnh viễn toàn bộ dữ liệu.',
    feedbackTitle: 'Góp ý & Chính sách Quyền riêng tư',
    feedbackPlaceholder: 'Gửi ý tưởng hoặc góp ý cải thiện cho VOI...',
    sendFeedbackBtn: 'Gửi góp ý',
    feedbackThanksMsg: 'Cảm ơn góp ý của bạn! ✨',
    privacyPolicyNote:
      'Chính sách Zero PII/Financial Leak: Không bao giờ gửi số tiền, ghi chú hay tên người nợ lên Analytics.',
  },
};

