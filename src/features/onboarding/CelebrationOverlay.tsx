import { useEffect, type ReactElement } from 'react';
import { Check, Flame, Heart, Sparkles, X } from 'lucide-react';
import { useUiStore } from '../../app/ui-store';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';
import { VoiFlowIcon } from '../../shared/ui/VoiFlowIcon';
import { getAvatarPresetMeta } from './WelcomeOnboardingModal';

export function CelebrationOverlay(): ReactElement | null {
  const { celebration, avatarId, streakDays, locale, dismissCelebration } = useUiStore();
  const isVi = locale === 'vi';
  const preset = getAvatarPresetMeta(avatarId);

  useEffect(() => {
    if (!celebration) return;
    const timeoutMs = celebration.variant === 'modal' ? 6500 : 3800;
    const timer = window.setTimeout(() => {
      dismissCelebration();
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [celebration, dismissCelebration]);

  if (!celebration) return null;

  // 1. FULL CELEBRATION MODAL (Image 4 Style + Pantone Palette: First Transaction / Streak Check-in / Salary Confirmed)
  if (celebration.variant === 'modal') {
    const isStreakModal = celebration.kind === 'no_spend_checkin';

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={celebration.title}
        data-testid="celebration-modal"
        onClick={dismissCelebration}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={
            !isStreakModal
              ? {
                  background: `linear-gradient(180deg, ${preset.cardBgHex} 0%, ${preset.characterFillHex}45 50%, ${preset.cardBgHex} 100%)`,
                  backgroundColor: preset.cardBgHex,
                }
              : undefined
          }
          className={`relative w-full max-w-sm overflow-hidden rounded-[36px] border-2 border-[#191919] p-6 text-center shadow-2xl ${
            isStreakModal ? 'bg-[#191919] text-[#FAFAFA]' : 'text-[#191919]'
          }`}
        >
          <button
            type="button"
            onClick={dismissCelebration}
            aria-label={isVi ? 'Đóng' : 'Close'}
            className={`absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full transition ${
              isStreakModal
                ? 'bg-white/15 text-[#FAFAFA] hover:bg-white/25'
                : 'bg-[#191919]/10 text-[#191919] hover:bg-[#191919]/20'
            }`}
          >
            <X className="h-4 w-4" />
          </button>

          <Sparkles
            className={`absolute top-7 left-7 h-5 w-5 ${
              isStreakModal ? 'text-[#F2D147]' : 'text-[#191919]'
            }`}
          />
          <Heart className="absolute top-14 right-9 h-5 w-5 fill-[#EF6EA5] text-[#EF6EA5]" />

          {isStreakModal && (
            <div className="mb-2 flex flex-col items-center">
              <span className="text-5xl font-black tracking-tight text-[#FAFAFA] tabular-nums">
                {streakDays}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#F7F296] px-3 py-0.5 text-[11px] font-extrabold text-[#191919]">
                <Flame className="h-3.5 w-3.5 fill-[#FF7A1A] text-[#FF7A1A]" />
                <span>{celebration.badgeText}</span>
              </span>
            </div>
          )}

          {/* Speech Bubble + Character Stage (Image 4 homage) */}
          <div className="my-3 flex flex-col items-center">
            {celebration.amountText && (
              <div className="mb-2 rounded-2xl border border-[#191919]/15 bg-[#FAFAFA] px-3.5 py-1.5 text-xs font-black text-[#191919] shadow-sm">
                {celebration.amountText}
              </div>
            )}

            <div className="relative flex h-36 w-36 items-center justify-center">
              <div
                className="absolute inset-2 rounded-[40px] border-2 bg-[#FFFFFF]/95 shadow-lg"
                style={{ borderColor: preset.characterFillHex }}
              />
              <div className="relative z-10">
                {celebration.flowMascot ? (
                  <VoiFlowIcon variant={celebration.flowMascot} mood="excited" size={112} />
                ) : (
                  <GeometricBuddy
                    shape={preset.shape}
                    colorHex={preset.characterFillHex}
                    accessory={preset.accessory}
                    blush
                    mood="excited"
                    size={124}
                  />
                )}
              </div>
            </div>
          </div>

          <h3 className="mt-3 text-xl leading-snug font-black">{celebration.title}</h3>
          <p
            className={`mt-1.5 text-xs leading-relaxed font-semibold ${
              isStreakModal ? 'text-[#FAFAFA]/80' : 'text-[#191919]/80'
            }`}
          >
            {celebration.subtitle}
          </p>

          <button
            type="button"
            data-testid="celebration-confirm-btn"
            onClick={dismissCelebration}
            className={`mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl px-5 py-3 text-sm font-black shadow-md transition hover:scale-[1.01] ${
              isStreakModal ? 'bg-[#F2D147] text-[#191919]' : 'bg-[#191919] text-[#FAFAFA]'
            }`}
          >
            <Check className="h-4 w-4 stroke-[2.8]" />
            <span>{isVi ? 'Tuyệt vời! Tiếp tục' : 'Awesome! Continue'}</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. SLEEK CONFIRMATION TOAST BANNER (Every time a transaction or balance adjustment is saved)
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="confirmation-toast"
      className="fixed inset-x-0 top-4 z-50 mx-auto max-w-md px-4"
    >
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-[#2E2E2E] bg-[#191919] px-4 py-3 text-[#FAFAFA] shadow-xl">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: celebration.flowMascot ? '#FFFFFF' : preset.cardBgHex }}
          >
            {celebration.flowMascot ? (
              <VoiFlowIcon variant={celebration.flowMascot} mood="excited" size={34} />
            ) : (
              <GeometricBuddy
                shape={preset.shape}
                colorHex={preset.characterFillHex}
                accessory={preset.accessory}
                blush
                mood="happy"
                size={34}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                style={{ backgroundColor: preset.characterFillHex }}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#FAFAFA]"
              >
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
              <p className="truncate text-xs font-black text-[#FAFAFA]">{celebration.title}</p>
            </div>
            <p className="mt-0.5 truncate text-[11px] font-medium text-[#FAFAFA]/75">
              {celebration.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissCelebration}
          aria-label={isVi ? 'Đóng thông báo' : 'Dismiss'}
          className="shrink-0 rounded-full p-1 text-[#FAFAFA]/60 transition hover:bg-white/10 hover:text-[#FAFAFA]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
