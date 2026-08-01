import "@/global.css"
import { Link } from "expo-router";
import { Text, View } from "react-native";
 
export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-3xl font-bold text-success">
          Welcome to React Native you little shit!
        </Text>
        <Link href={'/onboarding'} className="mt-4 rounded bg-primary text-white p-4">  Go to Onboarding</Link>
        
        <Link href={'/(auth)/sign-in'} className="mt-4 rounded bg-primary text-white p-4">Go to SignIn</Link>
        
        <Link href={'/(auth)/sign-up'} className="mt-4 rounded bg-primary text-white p-4">Go to SignUp</Link>
         <Link href={'/subscriptions/spotify'} className="mt-4 rounded bg-primary text-white p-4">Spotify Subscription</Link>
        <Link href={{
          pathname: '/subscriptions/[id]',
          params: {id: "claude"}
        }} className="mt-4 rounded bg-primary text-white p-4">Claude Max Subscription</Link>

    </View>
  );
}