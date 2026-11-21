import Svg, { Line, Path } from 'react-native-svg';

type Props={primary:string;accent:string;size?:number};

export default function EmptyBasketIllustration({primary,accent,size=40}:Props){
  return <Svg width={size} height={size} viewBox="0 0 52 52">
    <Path d="M11 21h30l-4 24H15z" fill="none" stroke={primary} strokeWidth={2.5} strokeLinejoin="round"/>
    <Path d="M18 21c1-8 4-13 8-13s7 5 8 13" fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round"/>
    <Line x1={20} y1={25} x2={22} y2={41} stroke={primary} strokeWidth={2}/>
    <Line x1={26} y1={24} x2={26} y2={42} stroke={primary} strokeWidth={2}/>
    <Line x1={32} y1={25} x2={30} y2={41} stroke={primary} strokeWidth={2}/>
    <Path d="M14 31h24" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round"/>
  </Svg>;
}
