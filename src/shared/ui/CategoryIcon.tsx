import type { ReactElement } from 'react';
import {
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  Gift,
  GraduationCap,
  HeartPulse,
  HelpCircle,
  Home,
  Laptop,
  Music,
  Percent,
  Plane,
  Scale,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Tv,
  Utensils,
  Zap,
} from 'lucide-react';
import { VoiFlowIcon } from './VoiFlowIcon';

export interface CategoryIconProps {
  slug?: string | null;
  colorHex?: string | null;
  txType?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

function getDefaultColorForTxType(txType?: string): string {
  switch (txType) {
    case 'income':
    case 'debt_collect':
      return '#52C470';
    case 'transfer':
      return '#5E89ED';
    case 'debt_lend':
    case 'debt_borrow':
    case 'debt_repay':
      return '#BF9BDE';
    default:
      return '#FF7A1A';
  }
}

function getPantoneBadgeStyle(colorHex: string): { backgroundColor: string; color: string } {
  const upper = colorHex.toUpperCase();
  // Map both new Pantone vibrant hexes and legacy category hexes to exact Pantone Soft Pastel + Vibrant pairs
  switch (upper) {
    case '#FF7A1A':
    case '#FF6B35':
      return { backgroundColor: '#F7D1C3', color: '#FF7A1A' };
    case '#52C470':
    case '#10B981':
    case '#059669':
      return { backgroundColor: '#B7EDB8', color: '#1E7E3A' };
    case '#5E89ED':
    case '#3B82F6':
    case '#0D9488':
      return { backgroundColor: '#BCDBEB', color: '#2F5FD0' };
    case '#EF6EA5':
    case '#F472B6':
    case '#FB7185':
      return { backgroundColor: '#F5C2D7', color: '#D13B7B' };
    case '#F2D147':
    case '#FFB703':
      return { backgroundColor: '#F7F296', color: '#A37A00' };
    case '#BF9BDE':
    case '#8B5CF6':
    case '#7C3AED':
      return { backgroundColor: '#D7C3F8', color: '#6E44A3' };
    default:
      return { backgroundColor: `${colorHex}26`, color: colorHex };
  }
}

export function CategoryIcon({
  slug,
  colorHex,
  txType,
  size = 'md',
  className = '',
}: CategoryIconProps): ReactElement {
  const resolvedColor = colorHex ?? getDefaultColorForTxType(txType);

  const boxClass =
    size === 'xs'
      ? 'h-5 w-5 rounded-md'
      : size === 'sm'
        ? 'h-8 w-8 rounded-xl'
        : size === 'lg'
          ? 'h-12 w-12 rounded-2xl'
          : 'h-9 w-9 rounded-2xl';

  const iconClass =
    size === 'xs'
      ? 'h-3 w-3 stroke-[2.3]'
      : size === 'sm'
        ? 'h-4 w-4 stroke-[2.2]'
        : size === 'lg'
          ? 'h-6 w-6 stroke-[2.2]'
          : 'h-4 w-4 stroke-[2.2]';

  const flowIconPx = size === 'xs' ? 14 : size === 'sm' ? 20 : size === 'lg' ? 32 : 24;

  const renderGlyph = (): ReactElement => {
    if (txType === 'debt_lend' || txType === 'debt_collect') {
      return <VoiFlowIcon variant="lend" size={flowIconPx} />;
    }
    if (txType === 'debt_borrow' || txType === 'debt_repay') {
      return <VoiFlowIcon variant="borrow" size={flowIconPx} />;
    }
    if (txType === 'transfer' || slug === 'internal-transfer') {
      return <VoiFlowIcon variant="transfer" size={flowIconPx} />;
    }

    switch (slug) {
      case 'food-dining':
      case 'eating-out':
      case 'food-delivery':
        return <Utensils className={iconClass} />;
      case 'coffee-tea':
        return <Coffee className={iconClass} />;
      case 'groceries':
        return <ShoppingCart className={iconClass} />;
      case 'transport':
      case 'ride-hailing':
      case 'fuel-parking':
      case 'vehicle-maintenance':
        return <Car className={iconClass} />;
      case 'housing-bills':
      case 'rent':
        return <Home className={iconClass} />;
      case 'utilities':
        return <Zap className={iconClass} />;
      case 'shopping':
      case 'fashion-beauty':
        return <ShoppingBag className={iconClass} />;
      case 'home-electronics':
        return <Smartphone className={iconClass} />;
      case 'lifestyle-social':
      case 'hangout-dating':
        return <Music className={iconClass} />;
      case 'subscriptions-media':
        return <Tv className={iconClass} />;
      case 'travel':
        return <Plane className={iconClass} />;
      case 'health-personal':
      case 'medical':
      case 'fitness-grooming':
        return <HeartPulse className={iconClass} />;
      case 'education-work':
      case 'books-courses':
      case 'software-ai':
        return <GraduationCap className={iconClass} />;
      case 'family-giving':
      case 'parents-support':
      case 'weddings-gifts':
      case 'gifts-cashback':
        return <Gift className={iconClass} />;
      case 'fees-interest':
        return <Percent className={iconClass} />;
      case 'salary':
        return <Briefcase className={iconClass} />;
      case 'bonus':
      case 'investment-income':
        return <TrendingUp className={iconClass} />;
      case 'freelance':
        return <Laptop className={iconClass} />;
      case 'internal-transfer':
        return <VoiFlowIcon variant="transfer" size={flowIconPx} />;
      case 'credit-card-payment':
        return <CreditCard className={iconClass} />;
      case 'balance-adjustment':
        return <Scale className={iconClass} />;
      case 'unknown-expense':
      case 'unknown-income':
        return <HelpCircle className={iconClass} />;
      default:
        break;
    }

    switch (txType) {
      case 'income':
      case 'debt_collect':
        return <VoiFlowIcon variant="income" size={flowIconPx} />;
      case 'transfer':
        return <VoiFlowIcon variant="transfer" size={flowIconPx} />;
      case 'debt_lend':
        return <VoiFlowIcon variant="lend" size={flowIconPx} />;
      case 'debt_borrow':
      case 'debt_repay':
        return <VoiFlowIcon variant="borrow" size={flowIconPx} />;
      default:
        return <VoiFlowIcon variant="expense" size={flowIconPx} />;
    }
  };

  const badgeStyle = getPantoneBadgeStyle(resolvedColor);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${boxClass} ${className}`}
      style={badgeStyle}
      aria-hidden="true"
    >
      {renderGlyph()}
    </span>
  );
}
