import { AppText as Text } from '@makanza/mobile-ui';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BackHeader } from '../components/ui';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props={
  colors:AppColors;dark:boolean;autoRefresh:boolean;newsletter:boolean;onBack:()=>void;
  onTheme:()=>void;onAutoRefresh:(value:boolean)=>void;onNewsletter:(value:boolean)=>void;
  onPrivacy:()=>void;onDeleteAccount:()=>void;
};

export default function PreferencesScreen({colors:c,dark,autoRefresh,newsletter,onBack,onTheme,onAutoRefresh,onNewsletter,onPrivacy,onDeleteAccount}:Props){
  const s=styles(c);
  const p=customerPalette(c);
  return <View style={s.screen}><BackHeader title="Settings" subtitle="Make Smile work for you" colors={c} onBack={onBack}/><ScrollView style={{flex:1}} contentContainerStyle={s.page}>
    <View style={s.introCard}>
      <View style={s.introIcon}><Ionicons name="settings-outline" size={22} color={p.primary}/></View>
      <Text style={s.introTitle}>A little more personal</Text>
      <Text style={s.body}>Fine-tune how Smile looks, keeps you updated, and protects your account.</Text>
    </View>
    <Text style={s.section}>APPEARANCE</Text>
    <View style={s.group}>
      <View style={[s.setting,s.settingDivider]}>
        <View style={s.settingIcon}><Ionicons name={dark?'moon-outline':'sunny-outline'} size={19} color={p.primary}/></View>
        <View style={s.copy}><Text style={s.rowTitle}>Dark mode</Text><Text style={s.body}>{dark?'Dark appearance is on':'Use a darker appearance'}</Text></View>
        <Switch value={dark} onValueChange={onTheme} trackColor={{false:p.border,true:p.primary}} thumbColor="white"/>
      </View>
      <Pressable accessibilityRole="button" onPress={()=>Platform.OS==='web'?window.alert('English is currently the available app language.'):Alert.alert('Language','English is currently the available app language.')} style={({pressed})=>[s.setting,pressed&&s.pressed]}>
        <View style={s.settingIcon}><Ionicons name="language-outline" size={19} color={p.primary}/></View>
        <View style={s.copy}><Text style={s.rowTitle}>Language</Text><Text style={s.body}>English</Text></View>
        <Ionicons name="chevron-forward" size={19} color={p.muted}/>
      </Pressable>
    </View>
    <Text style={s.section}>NOTIFICATIONS</Text>
    <View style={s.group}>
      <ToggleRow icon="notifications-outline" title="Order updates" detail="Refresh order progress while Orders is open." value={autoRefresh} onChange={onAutoRefresh} c={c}/>
      <ToggleRow icon="mail-outline" title="Newsletter" detail="Receive Smile news and occasional offers." value={newsletter} onChange={onNewsletter} c={c} last/>
    </View>
    <Text style={s.section}>ACCOUNT & PRIVACY</Text>
    <View style={s.group}>
      <Action icon="shield-checkmark-outline" title="Privacy policy" onPress={onPrivacy} c={c}/>
      <Action icon="trash-outline" title="Delete account" destructive onPress={onDeleteAccount} c={c} last/>
    </View>
  </ScrollView></View>;
}

function ToggleRow({icon,title,detail,value,onChange,c,last=false}:{icon:'notifications-outline'|'mail-outline';title:string;detail:string;value:boolean;onChange:(value:boolean)=>void;c:AppColors;last?:boolean}){
  const s=styles(c);
  const p=customerPalette(c);
  return <View style={[s.setting,!last&&s.settingDivider]}><View style={s.settingIcon}><Ionicons name={icon} size={19} color={p.primary}/></View><View style={s.copy}><Text style={s.rowTitle}>{title}</Text><Text style={s.body}>{detail}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{false:p.border,true:p.primary}} thumbColor="white"/></View>;
}

function Action({icon,title,onPress,c,destructive=false,last=false}:{icon:'shield-checkmark-outline'|'trash-outline';title:string;onPress:()=>void;c:AppColors;destructive?:boolean;last?:boolean}){
  const s=styles(c);
  const p=customerPalette(c);
  return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[s.setting,!last&&s.settingDivider,pressed&&s.pressed]}><View style={[s.settingIcon,destructive&&s.settingIconDanger]}><Ionicons name={icon} size={19} color={destructive?p.danger:p.primary}/></View><Text style={[s.rowTitle,s.copy,destructive&&{color:p.danger}]}>{title}</Text><Ionicons name="chevron-forward" size={19} color={p.muted}/></Pressable>;
}

const styles=(colors:AppColors)=>{
  const c=customerPalette(colors);
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:c.canvas},
    page:{padding:customerSpace.lg,paddingBottom:customerSpace.xxl},
    introCard:{padding:17,borderRadius:customerRadius.lg,backgroundColor:c.primarySoft},
    introIcon:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:c.surface},
    introTitle:{fontSize:17,fontWeight:'900',color:c.ink,marginTop:13},
    section:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:c.primary,marginTop:customerSpace.xl,marginBottom:9},
    group:{paddingHorizontal:12,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.lg,backgroundColor:c.surface},
    setting:{minHeight:66,flexDirection:'row',alignItems:'center',gap:11,paddingVertical:11},
    settingDivider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:c.border},
    settingIcon:{width:37,height:37,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:c.primarySoft},
    settingIconDanger:{backgroundColor:c.accentSoft},
    copy:{flex:1},
    rowTitle:{fontSize:12,fontWeight:'800',color:c.ink},
    body:{fontSize:10,lineHeight:16,color:c.muted,marginTop:4},
    pressed:{opacity:.75},
  });
};
