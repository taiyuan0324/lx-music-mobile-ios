import { useEffect } from 'react'
import { hideModal } from '@/core/version'

const VersionModal = ({ componentId }: { componentId: string }) => {

  // 👇 核心神经阻断：只要系统想呼叫这个弹窗，它立刻触发自我销毁指令！
  useEffect(() => {
    hideModal(componentId)
  }, [componentId])

  // 👇 视觉隐形：连一个像素都别想在屏幕上显示出来
  return null
}

export default VersionModal