import { StyleSheet } from 'react-native';

export const onboardingStyles=StyleSheet.create({
  loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#f6f7ef'},
  safe:{flex:1,backgroundColor:'#f6f7ef'},safeDark:{backgroundColor:'#0e1711'},
  top:{height:62,paddingHorizontal:21,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},topActions:{flexDirection:'row',alignItems:'center',gap:9},
  brand:{fontSize:19,fontWeight:'900',letterSpacing:-.5,color:'#192b23'},brandMark:{fontFamily:'serif',color:'#194c3a'},ops:{fontSize:11,fontWeight:'900',letterSpacing:1.1,color:'#e87c59'},skip:{fontSize:13,fontWeight:'800',color:'#58705e',padding:9},
  art:{height:270,marginHorizontal:20,marginTop:6,borderRadius:28,backgroundColor:'#e9efdc',alignItems:'center',justifyContent:'center',overflow:'hidden'},artDark:{backgroundColor:'#18251c'},
  orbitLarge:{position:'absolute',width:235,height:235,borderWidth:1,borderColor:'#d2dec1',borderRadius:130},orbitSmall:{position:'absolute',width:175,height:175,borderWidth:1,borderColor:'#d2dec1',borderRadius:100},orbitDark:{borderColor:'#344333'},
  iconBubble:{width:122,height:122,borderRadius:35,backgroundColor:'#194c3a',alignItems:'center',justifyContent:'center',transform:[{rotate:'-7deg'}],shadowColor:'#194c3a',shadowOpacity:.2,shadowRadius:18,shadowOffset:{width:0,height:9},elevation:7},icon:{fontSize:69,fontWeight:'700',color:'#d5ef81'},
  tag:{position:'absolute',bottom:25,left:18,paddingHorizontal:12,paddingVertical:8,borderRadius:18,backgroundColor:'white'},tagText:{fontSize:10,letterSpacing:1,fontWeight:'900',color:'#194c3a'},sparkle:{position:'absolute',top:22,right:27,width:38,height:38,borderRadius:13,backgroundColor:'#d5ef81',alignItems:'center',justifyContent:'center',transform:[{rotate:'12deg'}]},sparkleText:{fontSize:24,color:'#194c3a'},
  content:{flex:1,paddingHorizontal:25,paddingTop:23,paddingBottom:23,justifyContent:'flex-end'},eyebrow:{fontSize:11,letterSpacing:1.4,fontWeight:'900',color:'#6b8155',marginBottom:10},title:{fontSize:36,lineHeight:42,fontWeight:'800',letterSpacing:-1.2,color:'#192b23'},body:{fontSize:16,lineHeight:24,color:'#747d73',marginTop:10,maxWidth:350},
  progress:{flexDirection:'row',gap:7,marginTop:19,marginBottom:14},dot:{width:7,height:7,borderRadius:5,backgroundColor:'#d6dace'},dotActive:{width:24,backgroundColor:'#194c3a'},actions:{minHeight:52,flexDirection:'row',alignItems:'center',gap:12},prev:{minHeight:48,justifyContent:'center',paddingHorizontal:8},prevText:{fontSize:15,fontWeight:'700',color:'#526551'},next:{flex:1,minHeight:52,alignItems:'center',justifyContent:'center',backgroundColor:'#194c3a',borderRadius:15},nextText:{fontSize:15,fontWeight:'900',color:'white'},textDark:{color:'#edf3e9'},mutedDark:{color:'#aab4a8'}
});
