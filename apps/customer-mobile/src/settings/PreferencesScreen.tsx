import { AppText as Text } from '@makanza/mobile-ui';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BackHeader } from '../components/ui';
import type { AppColors } from '../theme/colors';

type Props={
  colors:AppColors;dark:boolean;autoRefresh:boolean;newsletter:boolean;onBack:()=>void;
  onTheme:()=>void;onAutoRefresh:(value:boolean)=>void;onNewsletter:(value:boolean)=>void;
  onPrivacy:()=>void;onDeleteAccount:()=>void;
};

export default function PreferencesScreen({colors:c,dark,autoRefresh,newsletter,onBack,onTheme,onAutoRefresh,onNewsletter,onPrivacy,onDeleteAccount}:Props){
  const s=styles(c);
  return <View style={s.screen}><BackHeader title="Settings" subtitle="Make Smile work for you" colors={c} onBack={onBack}/><ScrollView style={{flex:1}} contentContainerStyle={s.page}>
    <Text style={s.section}>APPEARANCE</Text>
    <View style={s.setting}>
      <Ionicons name={dark?'moon-outline':'sunny-outline'} size={24} color={c.green}/>
      <View style={s.copy}><Text style={s.rowTitle}>Dark mode</Text><Text style={s.body}>{dark?'Dark appearance is on':'Use a darker appearance'}</Text></View>
      <Switch value={dark} onValueChange={onTheme} trackColor={{false:c.line,true:c.green}} thumbColor="white"/>
    </View>
    <Pressable accessibilityRole="button" onPress={()=>Alert.alert('Language','English is currently the available app language.')} style={s.setting}>
      <Ionicons name="language-outline" size={24} color={c.green}/>
      <View style={s.copy}><Text style={s.rowTitle}>Language</Text><Text style={s.body}>English</Text></View>
      <Ionicons name="chevron-forward" size={21} color={c.muted}/>
    </Pressable>
    <Text style={s.section}>NOTIFICATIONS</Text>
    <ToggleRow icon="notifications-outline" title="Order updates" detail="Refresh order progress while Orders is open." value={autoRefresh} onChange={onAutoRefresh} c={c}/>
    <ToggleRow icon="mail-outline" title="Newsletter" detail="Receive Smile news and occasional offers." value={newsletter} onChange={onNewsletter} c={c}/>
    <Text style={s.section}>ACCOUNT & PRIVACY</Text>
    <Action icon="shield-checkmark-outline" title="Privacy policy" onPress={onPrivacy} c={c}/>
    <Action icon="trash-outline" title="Delete account" destructive onPress={onDeleteAccount} c={c}/>
  </ScrollView></View>;
}

function ToggleRow({icon,title,detail,value,onChange,c}:{icon:'notifications-outline'|'mail-outline';title:string;detail:string;value:boolean;onChange:(value:boolean)=>void;c:AppColors}){
  const s=styles(c);
  return <View style={s.setting}><Ionicons name={icon} size={24} color={c.green}/><View style={s.copy}><Text style={s.rowTitle}>{title}</Text><Text style={s.body}>{detail}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{false:c.line,true:c.green}} thumbColor="white"/></View>;
}

function Action({icon,title,onPress,c,destructive=false}:{icon:'shield-checkmark-outline'|'trash-outline';title:string;onPress:()=>void;c:AppColors;destructive?:boolean}){
  const s=styles(c);
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.setting}><Ionicons name={icon} size={24} color={destructive?'#a34232':c.green}/><Text style={[s.rowTitle,s.copy,destructive&&{color:'#a34232'}]}>{title}</Text><Ionicons name="chevron-forward" size={21} color={c.muted}/></Pressable>;
}

const styles=(c:AppColors)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.paper},
  page:{padding:22,paddingBottom:40},
  back:{minHeight:36,flexDirection:'row',alignItems:'center',alignSelf:'flex-start',gap:2,marginBottom:15},
  backText:{fontSize:13,fontWeight:'800',color:c.green},
  kicker:{fontSize:11,fontWeight:'900',letterSpacing:1.2,color:c.green},
  title:{fontSize:32,fontWeight:'900',color:c.ink,marginTop:7},
  section:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:c.muted,marginTop:24,marginBottom:7},
  setting:{minHeight:68,flexDirection:'row',alignItems:'center',gap:12,padding:13,marginTop:8,borderRadius:15,backgroundColor:c.card},
  copy:{flex:1},
  rowTitle:{fontSize:13,fontWeight:'800',color:c.ink},
  body:{fontSize:11,lineHeight:17,color:c.muted,marginTop:4},
});
