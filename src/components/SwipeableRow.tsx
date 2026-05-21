// // SwipeableRow.tsx
// import React, { useEffect } from 'react'
// import {
//     View,
//     Text,
//     StyleSheet,
//     LayoutChangeEvent,
// } from 'react-native'
// import Animated, {
//     useSharedValue,
//     useAnimatedStyle,
//     withSpring,
//     runOnJS,
//     interpolate,
//     Extrapolate,
//     runOnUI,
//     withTiming,
//     Easing,
//     withDelay,
// } from 'react-native-reanimated'
// import { Gesture, GestureDetector } from 'react-native-gesture-handler'
// import { Ionicons } from '@expo/vector-icons'

// const SWIPE_THRESHOLD = -100

// interface SwipeableRowProps {
//     children: React.ReactNode
//     onDelete: () => void
//     bounce?: boolean
// }

// export const SwipeableRow: React.FC<SwipeableRowProps> = ({
//     children,
//     onDelete,
//     bounce = false,
// }) => {
//     const translateX = useSharedValue(0)
//     const rowHeight = useSharedValue(0)

//     const onLayout = (e: LayoutChangeEvent) => {
//         rowHeight.value = e.nativeEvent.layout.height
//     }

//     const pan = Gesture.Pan()
//         .onUpdate((e) => {
//             translateX.value = Math.max(e.translationX, SWIPE_THRESHOLD)
//         })
//         .onEnd(() => {
//             if (translateX.value <= SWIPE_THRESHOLD) {
//                 runOnJS(onDelete)()
//             } else {
//                 translateX.value = withSpring(0)
//             }
//         })

//     useEffect(() => {
//         if (bounce) {
//             translateX.value = withDelay(
//                 400,
//                 withTiming(
//                     SWIPE_THRESHOLD * 0.6,
//                     { duration: 200 },
//                     (finished) => {
//                         'worklet'
//                         if (finished) {
//                             translateX.value = withSpring(0)
//                         }
//                     }
//                 )
//             )
//         }
//     }, [bounce])

//     // animate the row sliding
//     const animatedRowStyle = useAnimatedStyle(() => ({
//         transform: [{ translateX: translateX.value }],
//     }))

//     // animate the delete‐BG: height + opacity
//     const animatedBGStyle = useAnimatedStyle(() => {
//         // maps 0 → 0, SWIPE_THRESHOLD → 1
//         const opacity = interpolate(
//             translateX.value,
//             [0, SWIPE_THRESHOLD],
//             [0, 1],
//             Extrapolate.CLAMP
//         )
//         return {
//             height: rowHeight.value,
//             opacity,
//         }
//     })

//     return (
//         <View onLayout={onLayout} style={styles.wrapper}>
//             {/* red “Delete” background + icon */}
//             <Animated.View style={[styles.deleteBG, animatedBGStyle]}>
//                 <Ionicons name="trash" size={20} color="red" />
//             </Animated.View>

//             {/* your row content */}
//             <GestureDetector gesture={pan}>
//                 <Animated.View style={[animatedRowStyle]}>
//                     {children}
//                 </Animated.View>
//             </GestureDetector>
//         </View>
//     )
// }

// const styles = StyleSheet.create({
//     wrapper: {
//         overflow: 'hidden',
//     },
//     deleteBG: {
//         position: 'absolute',
//         right: -25,
//         width: Math.abs(SWIPE_THRESHOLD),
//         flexDirection: 'row',
//         alignItems: 'center',
//         justifyContent: 'center',
//     },
//     deleteText: {
//         color: '#fff',
//         fontWeight: '600',
//         marginLeft: 8,
//     },
// })

// export default SwipeableRow
