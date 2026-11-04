import { AppText as Text } from '@makanza/mobile-ui';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import type { AppColors } from '../theme/colors';

type Props={variant:'logo'|'cover';label:string;helper:string;uri:string;busy:boolean;colors:AppColors;onPick:()=>void;onRemove:()=>void};

export default function StoreMediaPicker({variant,label,helper,uri,busy,colors,onPick,onRemove}:Props){
  const s=styles(colors);const isLogo=variant==='logo';
  return <View style={s.field}>
    <View style={s.heading}>
      <View style={s.headingCopy}><Text style={s.label}>{label}</Text><Text style={s.helper}>{helper}</Text></View>
      <Text style={s.optional}>OPTIONAL</Text>
    </View>
    {isLogo?<View style={s.logoCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={uri?'Change store logo':'Choose store logo'} onPress={onPick} disabled={busy} style={s.logoTile}>
        {uri?<Image source={{uri}} resizeMode="cover" style={s.logoImage}/>:<View style={s.logoPlaceholder}><Ionicons name="image-outline" size={25} color={colors.green}/></View>}
        {busy&&<View style={s.logoLoading}><ActivityIndicator color={colors.green}/></View>}
      </Pressable>
      <View style={s.logoDetails}>
        <Text style={s.logoTitle}>{uri?'Logo ready':'Add your store logo'}</Text>
        <Text style={s.logoCopy}>Square photos look best on your store page.</Text>
        <View style={s.logoActions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onPick} style={[s.chooseButton,busy&&s.disabled]}>
            <Ionicons name="image-outline" size={16} color={colors.isDark?'#ecf7f0':'#176b4d'}/>
            <Text style={s.chooseText}>{busy?'Uploading…':uri?'Change logo':'Choose image'}</Text>
          </Pressable>
          {uri&&!busy&&<Pressable accessibilityRole="button" accessibilityLabel="Remove store logo" onPress={onRemove} style={s.removeButton}><Ionicons name="close" size={18} color="#a44232"/></Pressable>}
        </View>
      </View>
    </View>:<View style={s.coverWrap}>
      <Pressable accessibilityRole="button" accessibilityLabel={uri?'Change store cover image':'Choose store cover image'} onPress={onPick} disabled={busy} style={[s.coverCard,busy&&s.disabled]}>
        {uri?<Image source={{uri}} resizeMode="cover" style={s.coverImage}/>:<View style={s.coverPlaceholder}><View style={s.coverIcon}><Ionicons name="image-outline" size={25} color={colors.green}/></View><Text style={s.coverTitle}>Add a cover photo</Text><Text style={s.coverCopy}>Wide images make a great first impression</Text></View>}
        {uri&&!busy&&<View style={s.coverEdit}><Ionicons name="create-outline" size={15} color="white"/><Text style={s.coverEditText}>Change photo</Text></View>}
        {busy&&<View style={s.coverLoading}><ActivityIndicator color="white"/><Text style={s.coverEditText}>Uploading cover photo…</Text></View>}
      </Pressable>
      {uri&&!busy&&<Pressable accessibilityRole="button" accessibilityLabel="Remove cover image" onPress={onRemove} style={s.removeCover}><Ionicons name="trash-outline" size={15} color="#a34232"/><Text style={s.removeCoverText}>Remove cover photo</Text></Pressable>}
    </View>}
  </View>;
}

const styles=(c:AppColors)=>StyleSheet.create({
  field:{marginTop:16},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:9},headingCopy:{flex:1,gap:3},label:{fontSize:13,fontWeight:'800',color:c.ink},helper:{fontSize:11,color:c.muted},optional:{fontSize:9,fontWeight:'900',letterSpacing:.7,color:c.muted,backgroundColor:c.cream,paddingHorizontal:8,paddingVertical:5,borderRadius:0,overflow:'hidden'},
  logoCard:{flexDirection:'row',alignItems:'center',gap:13,padding:11,borderWidth:1,borderColor:c.line,borderRadius:0,backgroundColor:c.cream},logoTile:{width:76,height:76,borderRadius:0,overflow:'hidden',borderWidth:1,borderColor:c.line,backgroundColor:c.card,alignItems:'center',justifyContent:'center'},logoImage:{width:'100%',height:'100%'},logoPlaceholder:{flex:1,width:'100%',alignItems:'center',justifyContent:'center',backgroundColor:c.isDark?'#203b2d':'#e6f0ea'},logoLoading:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',backgroundColor:c.isDark?'rgba(10,18,14,.78)':'rgba(255,255,255,.84)'},logoDetails:{flex:1,gap:4},logoTitle:{fontSize:13,fontWeight:'900',color:c.ink},logoCopy:{fontSize:11,lineHeight:15,color:c.muted},logoActions:{flexDirection:'row',alignItems:'center',gap:8,marginTop:5},chooseButton:{minHeight:34,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:10,borderRadius:0,backgroundColor:c.isDark?'#24583f':'#dcece0'},chooseText:{fontSize:11,fontWeight:'800',color:c.isDark?'#ecf7f0':'#176b4d'},removeButton:{width:34,height:34,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:c.line,borderRadius:0,backgroundColor:c.card},
  coverWrap:{gap:7},coverCard:{height:158,borderRadius:0,overflow:'hidden',borderWidth:1,borderColor:c.line,borderStyle:'dashed',backgroundColor:c.cream},coverImage:{width:'100%',height:'100%'},coverPlaceholder:{flex:1,alignItems:'center',justifyContent:'center',gap:5,padding:12},coverIcon:{width:42,height:42,borderRadius:0,alignItems:'center',justifyContent:'center',backgroundColor:c.isDark?'#203b2d':'#e6f0ea',marginBottom:2},coverTitle:{fontSize:13,fontWeight:'900',color:c.ink},coverCopy:{fontSize:11,color:c.muted,textAlign:'center'},coverEdit:{position:'absolute',right:10,bottom:10,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:7,borderRadius:0,backgroundColor:'rgba(18,34,26,.82)'},coverEditText:{fontSize:11,fontWeight:'800',color:'white'},coverLoading:{...StyleSheet.absoluteFillObject,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,backgroundColor:'rgba(18,34,26,.72)'},removeCover:{alignSelf:'flex-end',flexDirection:'row',alignItems:'center',gap:5,paddingVertical:5,paddingHorizontal:3},removeCoverText:{fontSize:11,fontWeight:'800',color:'#a34232'},disabled:{opacity:.65},
});
