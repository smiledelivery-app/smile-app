import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import NativeFormData from 'react-native/Libraries/Network/FormData';

export function createUploadFormData(): FormData {
  if(Platform.OS==='web')return new FormData();
  return new NativeFormData() as unknown as FormData;
}

export async function appendMediaAsset(form:FormData,asset:ImagePickerAsset,fallbackName:string) {
  const name=asset.fileName??fallbackName;
  if(Platform.OS==='web'){
    const response=await fetch(asset.uri);
    if(!response.ok)throw new Error('Could not read the selected image.');
    const blob=await response.blob();
    form.append('file',blob.type?blob:new Blob([blob],{type:asset.mimeType??'image/jpeg'}),name);
    return;
  }
  form.append('file',{uri:asset.uri,name,type:asset.mimeType??'image/jpeg'} as unknown as Blob);
}
