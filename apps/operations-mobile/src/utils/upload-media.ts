import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

export async function appendMediaAsset(form:FormData,asset:ImagePickerAsset,fallbackName:string) {
  const name=asset.fileName??fallbackName;
  if(Platform.OS==='web'){
    const response=await fetch(asset.uri);
    if(!response.ok)throw new Error('Could not read the selected image.');
    form.append('file',await response.blob(),name);
    return;
  }
  form.append('file',{uri:asset.uri,name,type:asset.mimeType??'application/octet-stream'} as unknown as Blob);
}
