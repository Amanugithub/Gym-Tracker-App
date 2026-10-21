import { Tabs } from "expo-router";

const TabLayout = () => (
    <Tabs screenOptions={{ headerShown: false }}>
        <Tabs.Screen name='index' options={{ title: 'Home' }} />
        <Tabs.Screen name='subscriptions' options={{ title: 'Train' }} />
        <Tabs.Screen name='insights' options={{ title: 'Progress' }} />
        <Tabs.Screen name='settings' options={{ title: 'Profile' }} />
    </Tabs>
)

export default TabLayout
