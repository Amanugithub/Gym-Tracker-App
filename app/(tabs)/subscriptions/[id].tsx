import { View, Text } from 'react-native'
import React from 'react'
import { Link, useLocalSearchParams } from 'expo-router'

const SubscriptionsDetails  = () => {
    const {id} = useLocalSearchParams<{id: string}>();

  return (
    <View>
      <Text> subscriptionsDetails : {id} </Text>
      <Link href='/' className='border border-primary w-20 h-10 text-center flex justify-center items-center rounded-2xl hover:bg-accent hover:text-background'>Go Back</Link>
    </View>
  )
}

export default SubscriptionsDetails 