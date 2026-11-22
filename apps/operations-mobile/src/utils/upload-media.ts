import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

type MediaUploadResponse={ok:boolean;status:number;json:()=>Promise<unknown>};

export async function uploadMediaAsset(url:string,asset:ImagePickerAsset,fallbackName:string,parameters:Record<string,string>):Promise<MediaUploadResponse> {
  if(Platform.OS==='web'){
    const response=await fetch(asset.uri);
    if(!response.ok)throw new Error('Could not read the selected image.');
    const blob=await response.blob();
    const form=new FormData();
    form.append('file',blob.type?blob:new Blob([blob],{type:asset.mimeType??'image/jpeg'}),asset.fileName??fallbackName);
    for(const [key,value] of Object.entries(parameters))form.append(key,value);
    return fetch(url,{method:'POST',body:form});
  }

  const response=await FileSystem.uploadAsync(url,asset.uri,{
    httpMethod:'POST',
    uploadType:FileSystem.FileSystemUploadType.MULTIPART,
    fieldName:'file',
    mimeType:asset.mimeType??'image/jpeg',
    parameters,
  });
  return {
    ok:response.status>=200&&response.status<300,
    status:response.status,
    json:async()=>JSON.parse(response.body) as unknown,
  };
}
