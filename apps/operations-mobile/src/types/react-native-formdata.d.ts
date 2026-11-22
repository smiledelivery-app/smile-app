declare module 'react-native/Libraries/Network/FormData' {
  export default class NativeFormData {
    append(key: string, value: string | { uri: string; name?: string; type?: string }): void;
  }
}
