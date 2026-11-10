import { useState, type ReactElement } from 'react';
import { Flame, Share2, Sparkles } from 'lucide-react';
import { DEFAULT_SYSTEM_CATEGORIES } from '../../domain/categories/default-categories';
import {
  buildWeeklyRecapStorySvgDataUrl,
  type WeeklyRecapSummary,
} from '../../domain/analytics/weekly-recap';
import { formatMoney } from '../../domain/money/currency';
import { getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';

export interface WeeklyRecapCardProps {
  recap: WeeklyRecapSummary;
}

export function WeeklyRecapCard({ recap }: WeeklyRecapCardProps): ReactElement {
  const { t, locale } = useTranslation();
  const [privacyShare, setPrivacyShare] = useState(false);
  const [sharedDataUrl, setSharedDataUrl] = useState<string | null>(null);

  const quote = locale === 'vi' ? recap.quoteVi : recap.quoteEn;

  const handleShareStory = (): void => {
    const dataUrl = buildWeeklyRecapStorySvgDataUrl(recap, {
      hideExactAmounts: privacyShare,
      locale,
    });
    setSharedDataUrl(dataUrl);
  };

  return (
    <Card>
      <Card.Header bordered>
        <div>
          <h3 className="text-sm font-bold text-[var(--ink-primary)]">{t.m4.weeklyRecapTitle}</h3>
          <p className="text-[11px] text-[var(--ink-secondary)]">
            {recap.weekStartIso} → {recap.weekEndIso}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FF6B35]/14 px-2.5 py-0.5 text-xs font-extrabold text-[#FF6B35] tabular-nums">
          <Flame className="h-3.5 w-3.5 fill-[#FF6B35]" />
          <span>{recap.streakDays}d</span>
        </span>
      </Card.Header>

      <Card.Body className="mt-3 space-y-3">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p
                data-testid="weekly-recap-total"
                className="text-2xl font-extrabold text-[var(--ink-primary)] tabular-nums"
              >
                {formatMoney(recap.totalExpenseBaseMinor, 'VND', { hidden: privacyShare })}
              </p>
              {recap.deltaPercentage !== null && (
                <p className="mt-0.5 text-xs font-semibold text-[var(--ink-secondary)]">
                  {recap.deltaPercentage > 0
                    ? `+${recap.deltaPercentage}%`
                    : `${recap.deltaPercentage}%`}{' '}
                  {t.m4.vsLastWeekLabel}
                </p>
              )}
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF6B35]/12 text-[#FF6B35]">
              <Sparkles className="h-5 w-5" />
            </span>
          </div>

          <p className="mt-2.5 text-xs font-semibold text-[var(--ink-primary)]">{quote}</p>
        </div>

        {recap.topCategories.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-[var(--ink-secondary)] uppercase">
              {t.m4.top3CategoriesLabel}
            </p>
            {recap.topCategories.map((cat, idx) => {
              const sysCat = DEFAULT_SYSTEM_CATEGORIES.find((c) => c.id === cat.categoryId);
              const name = sysCat ? getCategoryDisplayName(sysCat, t) : cat.name;
              return (
                <div
                  key={cat.categoryId}
                  className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)]/70 px-3 py-1.5 text-xs"
                >
                  <span className="font-bold text-[var(--ink-primary)]">
                    #{idx + 1} {name}
                  </span>
                  <span className="font-extrabold text-[var(--ink-primary)] tabular-nums">
                    {privacyShare
                      ? `${cat.percentage}%`
                      : `${formatMoney(cat.amountBaseMinor, 'VND')} (${cat.percentage}%)`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-secondary)]">
          <input
            type="checkbox"
            checked={privacyShare}
            onChange={(e) => setPrivacyShare(e.target.checked)}
          />
          <span>{t.m4.privacyShareToggle}</span>
        </label>

        <Button variant="ink" size="md" fullWidth onClick={handleShareStory}>
          <Share2 className="h-4 w-4" />
          <span>{t.m4.shareStoryBtn}</span>
        </Button>

        {sharedDataUrl && (
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-2.5 text-center">
            <p className="mb-2 text-xs font-bold text-[#10B981]">{t.m4.storyCopiedNotice}</p>
            <img
              src={sharedDataUrl}
              alt="Weekly Recap Story Card"
              className="mx-auto max-h-64 rounded-xl border border-[var(--border-hairline)]"
            />
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
