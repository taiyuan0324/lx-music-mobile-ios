import TrackPlayer, { IOSCategory, IOSCategoryOptions, Event } from 'react-native-track-player'
import { updateOptions, setVolume, setPlaybackRate, migratePlayerCache } from './utils'

const initial = async({ volume, playRate, cacheSize, isHandleAudioFocus, isEnableAudioOffload }: {
  volume: number
  playRate: number
  cacheSize: number
  isHandleAudioFocus: boolean
  isEnableAudioOffload: boolean
}) => {
  if (global.lx.playerStatus.isIniting || global.lx.playerStatus.isInitialized) return
  global.lx.playerStatus.isIniting = true
  await migratePlayerCache()
  try {
    await TrackPlayer.setupPlayer({
      maxCacheSize: cacheSize * 1024,
      maxBuffer: 1000,
      waitForBuffer: true,
      handleAudioFocus: true, // 强制接管内部焦点
      audioOffload: isEnableAudioOffload,
      iosCategory: IOSCategory.Playback,
      iosCategoryOptions: [
        IOSCategoryOptions.AllowAirPlay,
        IOSCategoryOptions.AllowBluetoothA2DP,
      ],
      autoUpdateMetadata: true,
    })

    // 终极无延迟雷达：破解 iOS 电话/微信 后台假死机制
    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
      if (event.permanent) {
        // 永久打断（看视频、刷抖音），乖乖闭嘴
        await TrackPlayer.pause()
        return
      }

      if (event.paused) {
        // 暂时打断（来电话、发微信语音），暂停开火
        await TrackPlayer.pause()
      } else {
        // 打断解除，不等任何延迟，第一毫秒瞬间开火夺回阵地！
        await TrackPlayer.play().catch(e => console.log('强行复活失败:', e))
      }
    })

    global.lx.playerStatus.isInitialized = true
    await updateOptions()
    await setVolume(volume)
    await setPlaybackRate(playRate)
  } finally {
    global.lx.playerStatus.isIniting = false
  }
}

const isInitialized = () => global.lx.playerStatus.isInitialized

export {
  initial,
  isInitialized,
  setVolume,
  setPlaybackRate,
}

export {
  setResource,
  setPause,
  setPlay,
  setCurrentTime,
  getDuration,
  setStop,
  resetPlay,
  getPosition,
  updateMetaData,
  onStateChange,
  isEmpty,
  useBufferProgress,
  initTrackInfo,
} from './utils'