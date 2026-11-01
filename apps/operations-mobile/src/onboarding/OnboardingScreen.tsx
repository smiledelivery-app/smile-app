import { AppText as Text } from '@makanza/mobile-ui';
import { useState } from 'react';
import { Image, ImageBackground, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../components/AppIcon';
import { onboardingStyles as s } from '../theme/onboarding';

type WorkRole='VENDOR'|'RIDER';
const slides=[
  {eyebrow:'ONE PLATFORM, TWO WAYS TO MOVE',title:'Good work starts here.',body:'Run your kitchen or bring orders closer to home. Smile keeps each job clear from start to finish.',image:'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1400&q=85',tag:'WELCOME TO SMILE'},
  {eyebrow:'FOR LOCAL KITCHENS',title:'Make every order count.',body:'Keep new orders, preparation and handoffs in one simple workspace.',image:'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1400&q=85',tag:'VENDOR TOOLS'},
  {eyebrow:'FOR RIDERS',title:'Every delivery moves us forward.',body:'Go online when you are ready, see nearby offers and confirm each handoff.',image:'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1400&q=85',tag:'RIDER TOOLS'},
];

export default function OnboardingScreen({onSelectRole,onComplete,dark,onTheme}:{onSelectRole:(role:WorkRole)=>void;onComplete:()=>void;dark:boolean;onTheme:()=>void}){
  const [step,setStep]=useState(0);const slide=slides[step];
  return <SafeAreaView style={[s.safe,dark&&s.safeDark]}>
    <StatusBar barStyle="light-content" backgroundColor="#194c3a"/>
    <ImageBackground source={{uri:slide.image}} style={styles.image} imageStyle={styles.imageRadius}>
      <View style={styles.shade}/>
      <View style={styles.top}>
        <View style={styles.brand}><Image accessibilityLabel="Smile logo" source={require('../../assets/smile-logo.png')} resizeMode="contain" style={styles.logo}/><Text style={styles.brandName}>smile <Text style={styles.ops}>OPS</Text></Text></View>
        <View style={styles.actionsTop}>
          <Pressable accessibilityRole="button" accessibilityLabel={dark?'Switch to light mode':'Switch to dark mode'} onPress={onTheme} style={styles.theme}><Ionicons name={dark?'sunny-outline':'moon-outline'} size={21} color="white"/></Pressable>
          <Pressable accessibilityRole="button" onPress={onComplete} hitSlop={12}><Text style={styles.skip}>Skip</Text></Pressable>
        </View>
      </View>
      <View style={styles.photoTag}><Text style={styles.photoTagText}>{slide.tag}</Text></View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
        <View style={s.progress}>{slides.map((_,i)=><View key={i} style={[s.dot,i===step&&s.dotActive]}/>)}</View>
        {step<slides.length-1
          ? <View style={s.actions}>{step>0&&<Pressable accessibilityRole="button" onPress={()=>setStep(value=>value-1)} style={s.prev}><Text style={[s.prevText,dark&&s.textDark]}>Previous</Text></Pressable>}<Pressable accessibilityRole="button" onPress={()=>setStep(value=>value+1)} style={s.next}><Text style={s.nextText}>Next  →</Text></Pressable></View>
          : <View style={styles.roleChoices}>
              <Pressable accessibilityRole="button" onPress={()=>onSelectRole('VENDOR')} style={styles.roleCard}><View style={styles.roleIcon}><Ionicons name="storefront-outline" size={24} color="#194c3a"/></View><View style={styles.roleCopy}><Text style={styles.roleTitle}>Continue as a vendor</Text><Text style={styles.roleBody}>Manage a kitchen and its orders</Text></View><Ionicons name="arrow-forward" size={20} color="#194c3a"/></Pressable>
              <Pressable accessibilityRole="button" onPress={()=>onSelectRole('RIDER')} style={[styles.roleCard,styles.roleCardRider]}><View style={[styles.roleIcon,styles.riderIcon]}><Ionicons name="bicycle-outline" size={24} color="#194c3a"/></View><View style={styles.roleCopy}><Text style={styles.roleTitle}>Continue as a rider</Text><Text style={styles.roleBody}>Apply to deliver with Smile</Text></View><Ionicons name="arrow-forward" size={20} color="#194c3a"/></Pressable>
            </View>}
      </View>
    </ImageBackground>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  image:{flex:1,justifyContent:'space-between',backgroundColor:'#194c3a'},imageRadius:{},shade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(13,38,27,.38)'},
  top:{height:62,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{flexDirection:'row',alignItems:'center',gap:7},logo:{width:42,height:42},brandName:{fontSize:22,fontWeight:'900',letterSpacing:-.5,color:'white'},ops:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:'#d5ef81'},actionsTop:{flexDirection:'row',alignItems:'center',gap:12},theme:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.18)'},skip:{fontSize:13,fontWeight:'800',color:'white',padding:8},
  photoTag:{alignSelf:'flex-start',marginLeft:22,marginTop:18,paddingHorizontal:12,paddingVertical:8,borderRadius:18,backgroundColor:'#d5ef81'},photoTagText:{fontSize:10,letterSpacing:1,fontWeight:'900',color:'#194c3a'},
  content:{paddingHorizontal:24,paddingTop:24,paddingBottom:22,backgroundColor:'rgba(255,255,255,.96)',borderTopLeftRadius:28,borderTopRightRadius:28},eyebrow:{fontSize:11,letterSpacing:1.4,fontWeight:'900',color:'#6b8155',marginBottom:9},title:{fontSize:34,lineHeight:40,fontWeight:'800',letterSpacing:-1,color:'#192b23'},body:{fontSize:15,lineHeight:22,color:'#747d73',marginTop:8},
  roleChoices:{gap:9,marginTop:2},roleCard:{minHeight:68,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:13,paddingVertical:10,borderRadius:17,backgroundColor:'#e9f2e6',borderWidth:1,borderColor:'#d7e6d5'},roleCardRider:{backgroundColor:'#f1f3ec'},roleIcon:{width:43,height:43,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#d4e8d3'},riderIcon:{backgroundColor:'#dfe8d7'},roleCopy:{flex:1},roleTitle:{fontSize:14,fontWeight:'900',color:'#194c3a'},roleBody:{fontSize:11,color:'#65746a',marginTop:3},
});
