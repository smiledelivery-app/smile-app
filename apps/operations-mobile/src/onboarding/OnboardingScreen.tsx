import { useState } from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { onboardingStyles as s } from '../theme/onboarding';

const slides=[{eyebrow:'THE PEOPLE BEHIND EVERY DELIVERY',title:'Welcome to the work that moves us.',body:'One workspace for the kitchens making the food and the riders bringing it home.',icon:'sparkles-outline' as const,tag:'SMILE OPERATIONS'},{eyebrow:'A BETTER DAY IN THE KITCHEN',title:'Every order, clearly handled.',body:'Accept new orders, keep preparation moving and mark each handoff when it is ready.',icon:'receipt-outline' as const,tag:'FOR VENDORS'},{eyebrow:'GOOD THINGS ARE ON THE WAY',title:'Pick up. Ride out. Deliver.',body:'Go online when you are ready, accept nearby offers and confirm each delivery with the customer.',icon:'navigate-outline' as const,tag:'FOR RIDERS'}];

export default function OnboardingScreen({onComplete,dark,onTheme}:{onComplete:()=>void;dark:boolean;onTheme:()=>void}){
  const [step,setStep]=useState(0);const slide=slides[step];
  return <SafeAreaView style={[s.safe,dark&&s.safeDark]}>
    <StatusBar barStyle={dark?'light-content':'dark-content'} backgroundColor={dark?'#0e1711':'#f6f7ef'}/>
    <View style={s.top}>
      <Text style={[s.brand,dark&&s.textDark]}><Text style={s.brandMark}>m</Text> smile <Text style={s.ops}>OPS</Text></Text>
      <View style={s.topActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={dark?'Switch to light mode':'Switch to dark mode'} onPress={onTheme} style={{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:dark?'#18251c':'#f0f2e9'}}><Ionicons name={dark?'sunny-outline':'moon-outline'} size={23} color={dark?'#edf3e9':'#194c3a'}/></Pressable>
        <Pressable accessibilityRole="button" onPress={onComplete} hitSlop={12}><Text style={[s.skip,dark&&s.textDark]}>Skip</Text></Pressable>
      </View>
    </View>
    <View style={[s.art,dark&&s.artDark]}>
      <View style={[s.orbitLarge,dark&&s.orbitDark]}/><View style={[s.orbitSmall,dark&&s.orbitDark]}/>
      <View style={s.iconBubble}><Ionicons name={slide.icon} size={62} color="#d5ef81"/></View>
      <View style={s.tag}><Text style={s.tagText}>{slide.tag}</Text></View><View style={s.sparkle}><Text style={s.sparkleText}>✦</Text></View>
    </View>
    <View style={s.content}>
      <Text style={s.eyebrow}>{slide.eyebrow}</Text><Text style={[s.title,dark&&s.textDark]}>{slide.title}</Text><Text style={[s.body,dark&&s.mutedDark]}>{slide.body}</Text>
      <View style={s.progress}>{slides.map((_,i)=><View key={i} style={[s.dot,i===step&&s.dotActive]}/>)}</View>
      <View style={s.actions}>{step>0&&<Pressable accessibilityRole="button" onPress={()=>setStep(i=>i-1)} style={s.prev}><Text style={[s.prevText,dark&&s.textDark]}>Previous</Text></Pressable>}<Pressable accessibilityRole="button" onPress={()=>step<2?setStep(i=>i+1):onComplete()} style={s.next}><Text style={s.nextText}>{step<2?'Next':'Continue to sign in'}  →</Text></Pressable></View>
    </View>
  </SafeAreaView>;
}
