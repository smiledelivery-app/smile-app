import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppColors } from '../theme/colors';
import { vendorRadius, vendorSpace } from '../theme/vendor';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { Ionicons } from '../components/AppIcon';
import StoreMediaPicker from './StoreMediaPicker';

export type ProductDraft={name:string;description:string;category:string;price:string;stock:string;imageUrl:string};
export type ProductAddonDraft={id?:string;name:string;price:string};

type Props={
  draft:ProductDraft;
  editing:boolean;
  addons:ProductAddonDraft[];
  error:string;
  saving:boolean;
  mediaBusy:boolean;
  colors:AppColors;
  onChange:(patch:Partial<ProductDraft>)=>void;
  onAddonChange:(index:number,patch:Partial<ProductAddonDraft>)=>void;
  onRemoveAddon:(index:number)=>void;
  onAddAddon:()=>void;
  onPickImage:()=>void;
  onRemoveImage:()=>void;
  onSave:()=>void;
  onCancel:()=>void;
};

export default function VendorProductEditorScreen({draft,editing,addons,error,saving,mediaBusy,colors,onChange,onAddonChange,onRemoveAddon,onAddAddon,onPickImage,onRemoveImage,onSave,onCancel}:Props){
  const s=styles(colors);
  return <View style={s.screen}>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.heading}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to products" onPress={onCancel} style={s.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.ink}/>
        </Pressable>
        <View style={s.headingCopy}>
          <Text style={s.eyebrow}>MENU MANAGEMENT</Text>
          <Text style={s.title}>{editing?'Edit product':'Add a product'}</Text>
        </View>
        <View style={s.stepBadge}><Text style={s.stepText}>{editing?'EDIT':'NEW'}</Text></View>
      </View>
      <Text style={s.intro}>{editing?'Update the details customers see in your menu.':'Add a clear photo and the details customers need to order.'}</Text>

      <View style={s.section}>
        <SectionHeader number="01" title="Product photo" detail="A bright, square photo works best." colors={colors}/>
        <StoreMediaPicker variant="logo" label="Menu image" helper="Choose a photo from your device" uri={draft.imageUrl} busy={mediaBusy} colors={colors} onPick={onPickImage} onRemove={onRemoveImage}/>
      </View>

      <View style={s.section}>
        <SectionHeader number="02" title="Product details" detail="Start with the essentials." colors={colors}/>
        <FormField label="Product name" value={draft.name} onChangeText={name=>onChange({name})} placeholder="e.g. Jollof rice" dark={colors.isDark} style={s.fieldInput}/>
        <FormField label="Category" value={draft.category} onChangeText={category=>onChange({category})} placeholder="Rice, snacks, drinks…" dark={colors.isDark} style={s.fieldInput}/>
        <View style={s.fieldRow}>
          <View style={s.fieldColumn}><FormField label="Price (₦)" value={draft.price} onChangeText={price=>onChange({price})} placeholder="500" keyboardType="decimal-pad" dark={colors.isDark} style={s.fieldInput}/></View>
          <View style={s.fieldColumn}><FormField label="Stock (optional)" value={draft.stock} onChangeText={stock=>onChange({stock})} placeholder="Not tracked" keyboardType="number-pad" dark={colors.isDark} style={s.fieldInput}/></View>
        </View>
        <FormField label="Description (optional)" value={draft.description} onChangeText={description=>onChange({description})} placeholder="What makes this item special?" multiline numberOfLines={4} dark={colors.isDark} style={s.descriptionInput}/>
      </View>

      <View style={s.section}>
        <View style={s.extrasHeading}>
          <SectionHeader number="03" title="Extras" detail="Offer optional add-ons with their own prices." colors={colors}/>
          <View style={s.optionalBadge}><Text style={s.optionalText}>OPTIONAL</Text></View>
        </View>
        {addons.length===0&&<View style={s.emptyExtras}>
          <View style={s.emptyIcon}><Ionicons name="add-circle-outline" size={20} color={colors.green}/></View>
          <Text style={s.emptyTitle}>No extras added</Text>
          <Text style={s.emptyCopy}>Add choices like extra chicken or plantain.</Text>
        </View>}
        {addons.map((addon,index)=><View key={addon.id??`new-${index}`} style={s.addonCard}>
          <View style={s.addonHeader}>
            <Text style={s.addonNumber}>EXTRA {String(index+1).padStart(2,'0')}</Text>
            {!addon.id&&<Pressable accessibilityRole="button" accessibilityLabel={`Remove extra ${index+1}`} onPress={()=>onRemoveAddon(index)} hitSlop={8} style={s.removeAddon}><Ionicons name="close" size={16} color={colors.muted}/></Pressable>}
          </View>
          <View style={s.fieldRow}>
            <View style={s.fieldColumn}><FormField label="Extra name" value={addon.name} onChangeText={name=>onAddonChange(index,{name})} placeholder="e.g. Extra chicken" dark={colors.isDark} style={s.fieldInput}/></View>
            <View style={s.fieldColumn}><FormField label="Price (₦)" value={addon.price} onChangeText={price=>onAddonChange(index,{price})} placeholder="500" keyboardType="decimal-pad" dark={colors.isDark} style={s.fieldInput}/></View>
          </View>
        </View>)}
        {addons.length<20&&<PrimaryButton title="+ Add an extra" secondary onPress={onAddAddon} style={s.addExtraButton}/>}
      </View>

      {error?<View accessibilityRole="alert" style={s.errorBox}><Ionicons name="alert-circle-outline" size={17} color={colors.isDark?'#f0877a':'#a44232'}/><Text style={s.errorText}>{error}</Text></View>:null}
      <Text style={s.footerHint}>You can pause or edit this product from your menu at any time.</Text>
    </ScrollView>
    <View style={s.actions}>
      <PrimaryButton title={saving?'Saving…':editing?'Save changes':'Add product'} onPress={onSave} disabled={saving||mediaBusy} style={s.saveButton}/>
      <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={s.cancelButton}><Text style={s.cancelText}>Cancel</Text></Pressable>
    </View>
  </View>;
}

function SectionHeader({number,title,detail,colors}:{number:string;title:string;detail:string;colors:AppColors}){
  const s=styles(colors);
  return <View style={s.sectionHeader}>
    <View style={s.sectionNumber}><Text style={s.sectionNumberText}>{number}</Text></View>
    <View style={s.sectionCopy}><Text style={s.sectionTitle}>{title}</Text><Text style={s.sectionDetail}>{detail}</Text></View>
  </View>;
}

const styles=(c:AppColors)=>{
  const inputSurface=c.isDark?c.cream:'#f2f6f4';
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:c.paper},
    scroll:{flex:1},
    content:{paddingHorizontal:vendorSpace.md,paddingTop:vendorSpace.md,paddingBottom:vendorSpace.lg,gap:vendorSpace.md},
    heading:{flexDirection:'row',alignItems:'center',gap:vendorSpace.sm},
    backButton:{width:42,height:42,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:c.card},
    headingCopy:{flex:1,gap:3},
    eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:c.green},
    title:{fontSize:24,lineHeight:29,fontWeight:'900',letterSpacing:-.6,color:c.ink},
    stepBadge:{paddingHorizontal:10,paddingVertical:6,borderRadius:vendorRadius.pill,backgroundColor:c.mint},
    stepText:{fontSize:9,fontWeight:'900',letterSpacing:.6,color:c.green},
    intro:{marginTop:-8,fontSize:12,lineHeight:18,color:c.muted},
    section:{padding:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.xl,backgroundColor:c.card},
    sectionHeader:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:vendorSpace.sm},
    sectionNumber:{width:34,height:34,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.sm,backgroundColor:c.mint},
    sectionNumberText:{fontSize:10,fontWeight:'900',color:c.green},
    sectionCopy:{flex:1,gap:2},
    sectionTitle:{fontSize:14,fontWeight:'900',color:c.ink},
    sectionDetail:{fontSize:10,lineHeight:14,color:c.muted},
    fieldInput:{height:50,borderRadius:vendorRadius.md,borderColor:c.line,backgroundColor:inputSurface,fontSize:13,color:c.ink},
    descriptionInput:{minHeight:96,height:'auto',textAlignVertical:'top',paddingTop:13,borderRadius:vendorRadius.md,borderColor:c.line,backgroundColor:inputSurface,fontSize:13,color:c.ink},
    fieldRow:{flexDirection:'row',gap:vendorSpace.sm},
    fieldColumn:{flex:1,minWidth:0},
    extrasHeading:{flexDirection:'row',alignItems:'flex-start',gap:vendorSpace.xs},
    optionalBadge:{marginTop:4,paddingHorizontal:8,paddingVertical:5,borderRadius:vendorRadius.pill,backgroundColor:inputSurface},
    optionalText:{fontSize:8,fontWeight:'900',letterSpacing:.6,color:c.muted},
    emptyExtras:{alignItems:'center',paddingHorizontal:vendorSpace.md,paddingVertical:vendorSpace.md,borderWidth:1,borderStyle:'dashed',borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.paper},
    emptyIcon:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:c.mint},
    emptyTitle:{marginTop:vendorSpace.xs,fontSize:12,fontWeight:'900',color:c.ink},
    emptyCopy:{marginTop:3,fontSize:10,lineHeight:15,color:c.muted,textAlign:'center'},
    addonCard:{marginTop:vendorSpace.sm,padding:vendorSpace.sm,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.paper},
    addonHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
    addonNumber:{fontSize:8,fontWeight:'900',letterSpacing:.8,color:c.green},
    removeAddon:{width:30,height:30,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.pill,backgroundColor:c.card},
    addExtraButton:{minHeight:42,marginTop:vendorSpace.sm,borderRadius:vendorRadius.md},
    errorBox:{flexDirection:'row',alignItems:'flex-start',gap:8,padding:12,borderWidth:1,borderColor:c.isDark?'#75423b':'#f0c3ba',borderRadius:vendorRadius.md,backgroundColor:c.isDark?'#392a27':'#fff3ef'},
    errorText:{flex:1,color:c.isDark?'#f0877a':'#a44232',fontSize:11,lineHeight:16},
    footerHint:{paddingHorizontal:4,fontSize:10,lineHeight:15,color:c.muted,textAlign:'center'},
    actions:{gap:vendorSpace.xs,paddingHorizontal:vendorSpace.md,paddingTop:vendorSpace.sm,paddingBottom:vendorSpace.md,borderTopWidth:1,borderTopColor:c.line,backgroundColor:c.card},
    saveButton:{minHeight:50,marginTop:0,borderRadius:vendorRadius.md},
    cancelButton:{minHeight:38,alignItems:'center',justifyContent:'center'},
    cancelText:{fontSize:12,fontWeight:'800',color:c.muted},
  });
};
