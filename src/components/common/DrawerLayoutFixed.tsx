import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { 
  DrawerLayoutAndroid, 
  type DrawerLayoutAndroidProps, 
  View, 
  type LayoutChangeEvent, 
  Platform, 
  TouchableWithoutFeedback, 
  Dimensions, 
  Animated, 
  Easing 
} from 'react-native'
import { usePageVisible } from '@/store/common/hook'
import { type COMPONENT_IDS } from '@/config/constant'

interface Props extends DrawerLayoutAndroidProps {
  visibleNavNames: COMPONENT_IDS[]
  widthPercentage: number
  widthPercentageMax?: number
  edgeWidth?: number 
}

export interface DrawerLayoutFixedType {
  openDrawer: () => void
  closeDrawer: () => void
  fixWidth: () => void
}

const DrawerLayoutFixed = forwardRef<DrawerLayoutFixedType, Props>(({ 
  visibleNavNames, 
  widthPercentage, 
  widthPercentageMax, 
  children, 
  edgeWidth = 20, // 默认 20
  ...props 
}, ref) => {
  const drawerLayoutRef = useRef<DrawerLayoutAndroid>(null)
  const [w, setW] = useState<number | `${number}%`>( '100%')
  const [drawerWidth, setDrawerWidth] = useState(() => {
    const width = Dimensions.get('window').width
    const wp = Math.floor(width * widthPercentage)
    return widthPercentageMax ? Math.min(wp, widthPercentageMax) : wp
  })
  
  const [iosDrawerVisible, setIosDrawerVisible] = useState(false)
  const animValue = useRef(new Animated.Value(0)).current 
  
  const isAndroid = Platform.OS == 'android'
  const isLeft = props.drawerPosition != 'right'

  const animateDrawer = useCallback((toValue: number, callback?: () => void) => {
    Animated.timing(animValue, {
      toValue,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(callback)
  }, [animValue])

  useImperativeHandle(ref, () => ({
    openDrawer() {
      if (isAndroid) {
        drawerLayoutRef.current?.openDrawer()
        return
      }
      setIosDrawerVisible(true)
      animateDrawer(1)
    },
    closeDrawer() {
      if (isAndroid) {
        drawerLayoutRef.current?.closeDrawer()
        return
      }
      animateDrawer(0, () => setIosDrawerVisible(false))
    },
    fixWidth() {},
  }), [isAndroid, animateDrawer])

  if (!isAndroid) {
    return (
      <View style={{ flex: 1, width: '100%' }}>
        {children}
        {iosDrawerVisible && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
            <TouchableWithoutFeedback onPress={() => animateDrawer(0, () => setIosDrawerVisible(false))}>
              <Animated.View 
                style={{ 
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'black',
                  opacity: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] })
                }} 
              />
            </TouchableWithoutFeedback>
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                width: drawerWidth,
                height: '100%',
                backgroundColor: props.drawerBackgroundColor || '#ffffff',
                left: isLeft ? 0 : undefined,
                right: isLeft ? undefined : 0,
                transform: [{
                  translateX: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [isLeft ? -drawerWidth : drawerWidth, 0]
                  })
                }],
              }}
            >
              {props.renderNavigationView?.()}
            </Animated.View>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={{ width: w, flex: 1 }}>
      <DrawerLayoutAndroid 
        ref={drawerLayoutRef} 
        drawerWidth={drawerWidth} 
        drawerLockMode={edgeWidth === 0 ? 'locked-closed' : props.drawerLockMode} 
        {...props}
      >
        <View style={{ flex: 1 }}>{children}</View>
      </DrawerLayoutAndroid>
    </View>
  )
})

export default DrawerLayoutFixed
