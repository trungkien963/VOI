import type { ReactElement } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
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
  Users,
  Utensils,
  Zap,
} from 'lucide-react';

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
      return '#059669';
    case 'transfer':
      return '#0D9488';
    case 'debt_lend':
    case 'debt_borrow':
    case 'debt_repay':
      return '#7C3AED';
    default:
      return '#FF6B35';
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

  const renderGlyph = (): ReactElement => {
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
        return <ArrowLeftRight className={iconClass} />;
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
        return <ArrowDownLeft className={iconClass} />;
      case 'transfer':
        return <ArrowLeftRight className={iconClass} />;
      case 'debt_lend':
      case 'debt_borrow':
      case 'debt_repay':
        return <Users className={iconClass} />;
      default:
        return <ArrowUpRight className={iconClass} />;
    }
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${boxClass} ${className}`}
      style={{
        backgroundColor: `${resolvedColor}1F`,
        color: resolvedColor,
      }}
      aria-hidden="true"
    >
      {renderGlyph()}
    </span>
  );
}

