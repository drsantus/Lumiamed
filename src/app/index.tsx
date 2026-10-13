import { Text, View } from 'react-native';

/** SEGNAPOSTO: non è una schermata dell'app. Vedi RORK.md. */
export default function Segnaposto() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text>LumiaMed: segnaposto. Il motore di calcolo è in src/core; l&apos;interfaccia è in SwiftUI.</Text>
    </View>
  );
}
