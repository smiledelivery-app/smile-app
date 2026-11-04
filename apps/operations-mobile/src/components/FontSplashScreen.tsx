import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

export default function FontSplashScreen() {
  const pulse=useRef(new Animated.Value(.94)).current;
  const opacity=useRef(new Animated.Value(.5)).current;
  useEffect(()=>{
    const animation=Animated.loop(Animated.parallel([
      Animated.sequence([Animated.timing(pulse,{toValue:1,duration:850,easing:Easing.out(Easing.quad),useNativeDriver:true}),Animated.timing(pulse,{toValue:.94,duration:850,easing:Easing.in(Easing.quad),useNativeDriver:true})]),
      Animated.sequence([Animated.timing(opacity,{toValue:1,duration:850,useNativeDriver:true}),Animated.timing(opacity,{toValue:.5,duration:850,useNativeDriver:true})]),
    ]));animation.start();return()=>animation.stop();
  },[opacity,pulse]);
  return <View style={s.screen} accessibilityLabel="Loading Smile Operations">
    <View style={s.topLine}/>
    <Animated.View style={[s.brandBlock,{transform:[{scale:pulse}]}]}>
      <Image accessibilityLabel="Smile logo" source={require('../../assets/smile-logo.png')} resizeMode="contain" style={s.logo}/>
      <Text style={s.brand}>smile</Text><Text style={s.operations}>OPERATIONS</Text>
    </Animated.View>
    <Animated.View style={[s.copy,{opacity}]}><Text style={s.kicker}>YOUR WORKSPACE</Text><Text style={s.message}>Restoring your account and getting things ready.</Text><View style={s.track}><View style={s.fill}/></View></Animated.View>
    <Text style={s.footer}>CUSTOMERS · VENDORS · RIDERS</Text>
  </View>;
}

const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#194c3a',alignItems:'center',justifyContent:'center',padding:28},topLine:{position:'absolute',top:0,left:28,right:28,height:4,backgroundColor:'#d5ef81'},brandBlock:{alignItems:'center',justifyContent:'center'},logo:{width:78,height:78,marginBottom:8},brand:{color:'white',fontSize:36,fontWeight:'900',letterSpacing:-1},operations:{color:'#d5ef81',fontSize:10,fontWeight:'900',letterSpacing:2,marginTop:4},copy:{position:'absolute',left:30,right:30,bottom:92,alignItems:'center'},kicker:{color:'#b9d9c8',fontSize:10,letterSpacing:1.5,fontWeight:'800'},message:{color:'white',fontSize:15,lineHeight:22,marginTop:9,textAlign:'center'},track:{width:116,height:4,borderRadius:4,overflow:'hidden',backgroundColor:'#397858',marginTop:18},fill:{width:54,height:4,borderRadius:4,backgroundColor:'#f6f5f2'},footer:{position:'absolute',bottom:28,color:'#b9d9c8',fontSize:9,letterSpacing:1.1,fontWeight:'800'}});
