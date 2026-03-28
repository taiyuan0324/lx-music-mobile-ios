import { play as lyricPlay } from '@/plugins/lyric'
import TrackPlayer, { Capability, Event, RepeatMode, State } from 'react-native-track-player'
import { NativeModules, Platform } from 'react-native'
import BackgroundTimer from 'react-native-background-timer'
import { playMusic as handlePlayMusic } from './playList'
import { existsFile, moveFile, privateStorageDirectoryPath, temporaryDirectoryPath } from '@/utils/fs'
import { toast } from '@/utils/tools'
import playerStoreState from '@/store/player/state'

export { useBufferProgress } from './hook'
export { getDuration, getPosition } from './time'
export { updateNowPlayingTitles } from './nowPlaying'

const emptyIdRxp = /\/\/default$/
const tempIdRxp = /\/\/default$|\/\/default\/\/restorePlay$/
const nativeTrackPlayer = NativeModules.TrackPlayerModule as {
  isCached?: (url: string) => Promise<boolean>
  getCacheSize?: () => Promise<number>
  clearCache?: () => Promise<void>
}
export const isEmpty = (trackId = global.lx.playerTrackId) => !trackId || emptyIdRxp.test(trackId)
export const isTempId = (trackId = global.lx.playerTrackId) => !trackId || tempIdRxp.test(trackId)

const playMusic = ((fn: (musicInfo: LX.Player.PlayMusic, url: string, time: number) => void, delay = 800) => {
  let delayTimer: number | null = null
  let isDelayRun = false
  let timer: number | null = null
  let _musicInfo: LX.Player.PlayMusic | null = null
  let _url = ''
  let _time = 0
  return (musicInfo: LX.Player.PlayMusic, url: string, time: number) => {
    _musicInfo = musicInfo
    _url = url
    _time = time
    if (timer) {
      BackgroundTimer.clearTimeout(timer)
      timer = null
    }
    if (isDelayRun) {
      if (delayTimer) {
        BackgroundTimer.clearTimeout(delayTimer)
        delayTimer = null
      }
      timer = BackgroundTimer.setTimeout(() => {
        timer = null
        let musicInfo = _musicInfo
        let url = _url
        let time = _time
        _musicInfo = null
        _url = ''
        _time = 0
        isDelayRun = false
        fn(musicInfo!, url, time)
      }, delay)
    } else {
      isDelayRun = true
      fn(musicInfo, url, time)
      delayTimer = BackgroundTimer.setTimeout(() => {
        delayTimer = null
        isDelayRun = false
      }, 500)
    }
  }
})((musicInfo, url, time) => {
  handlePlayMusic(musicInfo, url, time)
})

export const setResource = (musicInfo: LX.Player.PlayMusic, url: string, duration?: number) => {
  playMusic(musicInfo, url, duration ?? 0)
}

export const setPlay = async() => TrackPlayer.play()
export const setStop = async() => { await TrackPlayer.stop() }
export const setLoop = async(loop: boolean) => TrackPlayer.setRepeatMode(loop ? RepeatMode.Off : RepeatMode.Track)
export const setPause = async() => TrackPlayer.pause()

// 💣 进度跳转核心增强
let isSeeking = false
export const setCurrentTime = async(time: number) => {
  if (isSeeking) return
  isSeeking = true
  try {
    // 1. 让底层原生播放器跳转
    await TrackPlayer.seekTo(time)
    lyricPlay(time)
    // 2. 给予 iOS 引擎 200ms 平稳期
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // 3. 强行更新 Store 状态，让 UI 进度条闭嘴不横跳
    if (playerStoreState.progress) {
      playerStoreState.progress.nowPlayTime = time
    }

    // 4. 发射最高优先级广播，直接“踹醒”歌词引擎重置时间
    if (global.app_event) {
      global.app_event.emit('setProgress', time)
    }
  } catch (err) {
    console.warn('Seek Error:', err)
  } finally {
    setTimeout(() => { isSeeking = false }, 300)
  }
}

export const setVolume = async(num: number) => TrackPlayer.setVolume(num)
export const setPlaybackRate = async(num: number) => TrackPlayer.setRate(num)
export const resetPlay = async() => Promise.all([setPause(), setCurrentTime(0)])

export const isCached = async(url: string) => {
  if (Platform.OS == 'ios' && typeof nativeTrackPlayer.isCached != 'function') return false
  return TrackPlayer.isCached(url)
}
export const getCacheSize = async() => {
  if (Platform.OS == 'ios' && typeof nativeTrackPlayer.getCacheSize != 'function') return 0
  return TrackPlayer.getCacheSize()
}
export const clearCache = async() => {
  if (Platform.OS == 'ios' && typeof nativeTrackPlayer.clearCache != 'function') return
  return TrackPlayer.clearCache()
}
export const migratePlayerCache = async() => {
  const newCachePath = privateStorageDirectoryPath + '/TrackPlayer'
  if (await existsFile(newCachePath)) return
  const oldCachePath = temporaryDirectoryPath + '/TrackPlayer'
  if (!await existsFile(oldCachePath)) return
  let timeout: number | null = BackgroundTimer.setTimeout(() => {
    timeout = null
    toast(global.i18n.t('player_cache_migrating'), 'long')
  }, 2_000)
  await moveFile(oldCachePath, newCachePath).finally(() => {
    if (timeout) BackgroundTimer.clearTimeout(timeout)
  })
}

export const destroy = async() => {
  if (global.lx.playerStatus.isIniting || !global.lx.playerStatus.isInitialized) return
  await TrackPlayer.destroy()
  global.lx.playerStatus.isInitialized = false
}

type PlayStatus = 'None' | 'Ready' | 'Playing' | 'Paused' | 'Stopped' | 'Buffering' | 'Connecting'

export const onStateChange = async(listener: (state: PlayStatus) => void) => {
  const sub = TrackPlayer.addEventListener(Event.PlaybackState, state => {
    let _state: PlayStatus
    switch (state) {
      case State.Ready: _state = 'Ready'; break
      case State.Playing: _state = 'Playing'; break
      case State.Paused: _state = 'Paused'; break
      case State.Stopped: _state = 'Stopped'; break
      case State.Buffering: _state = 'Buffering'; break
      case State.Connecting: _state = 'Connecting'; break
      default: _state = 'None'; break
    }
    listener(_state)
  })
  return () => { sub.remove() }
}

export const updateOptions = async(options = {
  capabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SeekTo, Capability.SkipToNext, Capability.SkipToPrevious],
  notificationCapabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SkipToNext, Capability.SkipToPrevious],
  compactCapabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SkipToNext],
}) => {
  return TrackPlayer.updateOptions(options)
}

export { updateMetaData, initTrackInfo } from './playList'
