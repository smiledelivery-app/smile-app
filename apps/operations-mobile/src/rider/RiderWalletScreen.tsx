import type { AppColors } from '../theme/colors';
import VendorWalletScreen from '../vendor/VendorWalletScreen';

export default function RiderWalletScreen({token,colors}:{token:string;colors:AppColors}){
  return <VendorWalletScreen token={token} colors={colors} role="RIDER"/>;
}
