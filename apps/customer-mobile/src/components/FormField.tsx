import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export default function FormField({label,dark=false,...props}:{label:string;dark?:boolean}&TextInputProps){return <View style={s.wrap}><Text style={[s.label,dark&&s.textDark]}>{label}</Text><TextInput {...props} placeholderTextColor={dark?'#9ba99e':'#9aa197'} style={[s.input,dark&&s.inputDark,props.style]}/></View>}
const s=StyleSheet.create({wrap:{marginTop:12},label:{fontSize:13,fontWeight:'700',color:'#27382d',marginBottom:7},input:{height:51,borderRadius:14,borderWidth:1,borderColor:'#e4e7de',backgroundColor:'white',paddingHorizontal:14,fontSize:16,color:'#192b23'},inputDark:{borderColor:'#2a382f',backgroundColor:'#18251c',color:'#edf3e9'},textDark:{color:'#edf3e9'}});
