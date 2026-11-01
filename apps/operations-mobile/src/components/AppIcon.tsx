import {
  ArrowRight, Bike, Bell, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, CircleCheckBig, CircleHelp, CircleUserRound, Clock3, CreditCard,
  Eye, EyeOff, House, Info, Languages, LockKeyhole, LogIn, LogOut,
  Mail, Map, MapPin, Moon, Navigation, Pencil, Phone, Plus, ReceiptText,
  RefreshCw, Search, Settings, ShieldCheck, ShoppingBag, Store, Sun, Trash2,
  TriangleAlert, Utensils, WalletCards, X, Zap, CircleDot, type LucideIcon,
} from 'lucide-react-native';

type Props={name:string;size?:number;color?:string;strokeWidth?:number};
const icons:Record<string,LucideIcon>={
  add:Plus,'arrow-forward':ArrowRight,'chevron-back':ChevronLeft,'chevron-forward':ChevronRight,'chevron-down':ChevronDown,
  close:X,'create-outline':Pencil,'bicycle-outline':Bike,'storefront-outline':Store,'home-outline':House,
  'moon-outline':Moon,'sunny-outline':Sun,'person-outline':CircleUserRound,'receipt-outline':ReceiptText,
  'cube-outline':Boxes,'flash-outline':Zap,'map-outline':Map,'navigate-outline':Navigation,
  'notifications-outline':Bell,'time-outline':Clock3,'location-outline':MapPin,'search-outline':Search,
  'wallet-outline':WalletCards,'card-outline':CreditCard,'mail-outline':Mail,'phone-outline':Phone,
  'log-out-outline':LogOut,'log-in-outline':LogIn,'lock-closed-outline':LockKeyhole,
  'settings-outline':Settings,'help-circle-outline':CircleHelp,'information-circle-outline':Info,
  'shield-checkmark-outline':ShieldCheck,'trash-outline':Trash2,'eye-outline':Eye,'eye-off-outline':EyeOff,
  'refresh-outline':RefreshCw,'restaurant-outline':Utensils,'language-outline':Languages,
  'bag-handle-outline':ShoppingBag,'checkmark':Check,'checkmark-circle-outline':CircleCheckBig,
  'alert-circle-outline':CircleAlert,'warning-outline':TriangleAlert,'chatbubble-outline':Phone,
};

export function AppIcon({name,size=24,color,strokeWidth=2.2}:Props){const Icon=icons[name]??CircleDot;return <Icon size={size} color={color} strokeWidth={strokeWidth}/>;}
export const Ionicons=AppIcon;
