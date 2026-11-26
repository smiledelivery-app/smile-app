import { AppText as Text } from '@makanza/mobile-ui';
import { WebView, type DomWebViewRef } from '@expo/dom-webview';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent, type Region } from 'react-native-maps';
import type { AppColors } from '../theme/colors';
import { hasNativeGoogleMapsSdk } from '../utils/google-maps';
import { getLeafletMapUri } from '../utils/leaflet-html';

type Coordinate={latitude:number;longitude:number};
type Props={point:Coordinate|null;colors:AppColors;onPick:(point:Coordinate)=>void};

const nigeriaRegion:Region={latitude:9.082,longitude:8.6753,latitudeDelta:9.8,longitudeDelta:12.2};

const leafletMapHtml=`<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      onerror="this.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'">
    <style>html,body,#map{height:100%;width:100%;margin:0;background:#e8ede8}.leaflet-container{font-family:Arial,sans-serif}</style>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      if (!window.L) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'error'}));
      } else {
        const map = L.map('map').setView([9.082, 8.6753], 6);
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        });
        let fallbackLoaded = false;
        tiles.on('tileerror', () => {
          if (fallbackLoaded) return;
          fallbackLoaded = true;
          map.removeLayer(tiles);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
          }).addTo(map);
        });
        tiles.addTo(map);
        let marker = null;
        window.setStorePin = (latitude, longitude) => {
          const position = [latitude, longitude];
          if (marker) marker.setLatLng(position);
          else marker = L.marker(position).addTo(map);
          map.setView(position, 15);
        };
        map.on('click', event => {
          const latitude = event.latlng.lat;
          const longitude = event.latlng.lng;
          window.setStorePin(latitude, longitude);
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'pick', latitude, longitude}));
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
      }
    </script>
  </body>
</html>`;

const setWebMapPin=(point:Coordinate)=>`window.setStorePin(${point.latitude},${point.longitude});true;`;

function GoogleStoreMapPicker({point,colors,onPick,onFallback}:{point:Coordinate|null;colors:AppColors;onPick:(point:Coordinate)=>void;onFallback:()=>void}){
  const mapRef=useRef<MapView>(null);
  const [mapReady,setMapReady]=useState(false);

  useEffect(()=>{
    if(mapReady)return;
    const timer=setTimeout(onFallback,8000);
    return()=>clearTimeout(timer);
  },[mapReady,onFallback]);

  useEffect(()=>{
    if(!point||!mapReady)return;
    mapRef.current?.animateToRegion({...point,latitudeDelta:.015,longitudeDelta:.015},300);
  },[mapReady,point?.latitude,point?.longitude]);

  return <View style={[styles.frame,{borderColor:colors.line,backgroundColor:colors.cream}]}>
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      initialRegion={point?{...point,latitudeDelta:.025,longitudeDelta:.025}:nigeriaRegion}
      onMapReady={()=>setMapReady(true)}
      onPress={(event:MapPressEvent)=>onPick(event.nativeEvent.coordinate)}
      showsCompass
      toolbarEnabled={false}
    >
      {point&&<Marker coordinate={point} title="Store location" pinColor={colors.green}/>}
    </MapView>
    {!point&&<View pointerEvents="none" style={[styles.hint,{backgroundColor:colors.card}]}><Text style={[styles.hintText,{color:colors.ink}]}>Tap the map to set your store pin</Text></View>}
  </View>;
}

function LeafletStoreMapPicker({point,colors,onPick}:{point:Coordinate|null;colors:AppColors;onPick:(point:Coordinate)=>void}){
  const webMap=useRef<DomWebViewRef>(null);
  const pointRef=useRef(point);
  pointRef.current=point;
  const [mapReady,setMapReady]=useState(false);
  const [mapError,setMapError]=useState(false);
  const source=useMemo(()=>({uri:getLeafletMapUri('vendor-store-map.html',leafletMapHtml)}),[]);

  useEffect(()=>{
    if(!point||!mapReady)return;
    webMap.current?.injectJavaScript(setWebMapPin(point));
  },[mapReady,point?.latitude,point?.longitude]);

  const handleWebMessage=(event:{nativeEvent:{data:string}})=>{
    let message:{type?:string;latitude?:number;longitude?:number};
    try{
      message=JSON.parse(event.nativeEvent.data) as typeof message;
    }catch{
      setMapError(true);
      return;
    }
    if(message.type==='ready'){
      setMapReady(true);
      setMapError(false);
      if(pointRef.current)webMap.current?.injectJavaScript(setWebMapPin(pointRef.current));
    }else if(
      message.type==='pick'&&
      typeof message.latitude==='number'&&
      Number.isFinite(message.latitude)&&
      typeof message.longitude==='number'&&
      Number.isFinite(message.longitude)
    ){
      onPick({latitude:message.latitude,longitude:message.longitude});
    }else if(message.type==='error'){
      setMapError(true);
    }
  };

  return <View style={[styles.frame,{borderColor:colors.line,backgroundColor:colors.cream}]}>
    <WebView
      ref={webMap}
      style={styles.map}
      containerStyle={styles.map}
      source={source}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onMessage={handleWebMessage}
      onRenderProcessGone={()=>setMapError(true)}
      onContentProcessDidTerminate={()=>setMapError(true)}
    />
    {!mapReady&&!mapError&&(
      <View pointerEvents="none" style={[styles.overlay,{backgroundColor:colors.card}]}>
        <ActivityIndicator color={colors.green}/>
        <Text style={[styles.hintText,{color:colors.ink}]}>Loading map…</Text>
      </View>
    )}
    {mapError&&(
      <View pointerEvents="none" style={[styles.overlay,{backgroundColor:colors.card}]}>
        <Text style={[styles.hintText,{color:colors.ink}]}>Map could not load. Check your internet connection or search for an address above.</Text>
      </View>
    )}
    {mapReady&&!mapError&&!point&&(
      <View pointerEvents="none" style={[styles.hint,{backgroundColor:colors.card}]}>
        <Text style={[styles.hintText,{color:colors.ink}]}>Tap the map to set your store pin</Text>
      </View>
    )}
  </View>;
}

export default function VendorStoreMapPicker({point,colors,onPick}:Props){
  const [useFallback,setUseFallback]=useState(()=>!hasNativeGoogleMapsSdk());
  const triggerFallback=useCallback(()=>setUseFallback(true),[]);
  if(!useFallback)return <GoogleStoreMapPicker point={point} colors={colors} onPick={onPick} onFallback={triggerFallback}/>;
  return <LeafletStoreMapPicker point={point} colors={colors} onPick={onPick}/>;
}

const styles=StyleSheet.create({
  frame:{height:260,overflow:'hidden',borderWidth:1,borderRadius:14,marginTop:10},
  map:{width:'100%',height:'100%'},
  overlay:{position:'absolute',top:0,right:0,bottom:0,left:0,alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:18},
  hint:{position:'absolute',top:10,left:10,right:10,alignSelf:'center',paddingHorizontal:12,paddingVertical:9,borderRadius:11,opacity:.96},
  hintText:{fontSize:11,fontWeight:'700',textAlign:'center'},
});
