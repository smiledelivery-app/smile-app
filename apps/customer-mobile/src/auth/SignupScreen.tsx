import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, StyleSheet, View } from 'react-native';
import FormField from '../components/FormField';
import { Button } from '../components/ui';
import { Ionicons } from '../components/AppIcon';
import { darkColors, lightColors } from '../theme/colors';
import AuthLayout,{authTextStyles as t} from './AuthLayout';

type Channel='sms'|'whatsapp';
type Props={dark:boolean;name:string;email:string;phone:string;password:string;channel:Channel;error:string;busy:boolean;onName:(v:string)=>void;onEmail:(v:string)=>void;onPhone:(v:string)=>void;onPassword:(v:string)=>void;onChannel:(v:Channel)=>void;onSubmit:()=>void;onLogin:()=>void;onTheme:()=>void};
export default function SignupScreen(p:Props){const colors=p.dark?darkColors:lightColors;return <AuthLayout dark={p.dark} onTheme={p.onTheme}>
  <Text style={[t.kicker,p.dark&&t.mutedDark]}>YOUR SMILE ACCOUNT</Text><Text style={[t.title,p.dark&&t.textDark]}>Let’s get you started.</Text><Text style={[t.body,p.dark&&t.mutedDark]}>Create your account and verify your phone to keep your orders connected to you.</Text>
  <FormField dark={p.dark} label="Your name" value={p.name} onChangeText={p.onName} placeholder="First and last name" autoComplete="name"/>
  <FormField dark={p.dark} label="Email address" value={p.email} onChangeText={p.onEmail} placeholder="you@example.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address"/>
  <FormField dark={p.dark} label="Phone number" value={p.phone} onChangeText={p.onPhone} placeholder="+234 801 234 5678" autoComplete="tel" keyboardType="phone-pad"/>
  <Text style={[s.channelLabel,p.dark&&t.textDark]}>Send verification code by</Text>
  <View style={s.channels}>{(['sms','whatsapp'] as const).map(option=><Pressable key={option} accessibilityRole="radio" accessibilityState={{checked:p.channel===option}} onPress={()=>p.onChannel(option)} style={[s.channel,p.dark&&s.channelDark,p.channel===option&&s.channelSelected]}><Ionicons name={option==='sms'?'chatbubble-outline':'logo-whatsapp'} size={19} color={p.channel===option?'#1d6147':p.dark?'#b5bcb3':'#4f5451'}/><Text style={[s.channelText,p.dark&&t.mutedDark,p.channel===option&&s.channelTextSelected]}>{option==='sms'?'SMS':'WhatsApp'}</Text>{p.channel===option&&<Ionicons name="checkmark-circle-outline" size={17} color="#1d6147"/>}</Pressable>)}</View>
  <FormField dark={p.dark} label="Password" value={p.password} onChangeText={p.onPassword} placeholder="At least 10 characters" secureTextEntry autoComplete="new-password"/>
  {p.error?<Text accessibilityRole="alert" style={t.error}>{p.error}</Text>:null}
  <Button title={p.busy?'Sending verification code…':'Continue to verification'} colors={colors} loading={p.busy} onPress={p.onSubmit} style={{marginTop:18}}/>
  <Pressable onPress={p.onLogin}><Text style={[t.link,p.dark&&t.textDark]}>Already have an account? Sign in</Text></Pressable>
</AuthLayout>}

const s=StyleSheet.create({channelLabel:{fontSize:12,fontWeight:'800',color:'#1f2321',marginTop:16,marginBottom:8},channels:{flexDirection:'row',gap:9},channel:{minHeight:45,flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:8,borderWidth:1,borderColor:'#eaeae7',borderRadius:13,backgroundColor:'#fff'},channelDark:{backgroundColor:'#111a15',borderColor:'rgba(239,240,231,0.09)'},channelSelected:{borderColor:'#1d6147',backgroundColor:'#e6f0ea'},channelText:{fontSize:12,fontWeight:'800',color:'#4f5451'},channelTextSelected:{color:'#1d6147'}});
