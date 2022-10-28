import useAppSettings from '@/application/common/useAppSettings'
import { useEvent } from '@/hooks/useEvent'
import { useHover } from '@/hooks/useHover'
import { useSignalState } from '@/hooks/useSignalState'
import useToggle from '@/hooks/useToggle'
import produce from 'immer'
import { RefObject, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Card from '../Card'
import Col from '../Col'
import Icon from '../Icon'
import LinkExplorer from '../LinkExplorer'
import LoadingCircleSmall from '../LoadingCircleSmall'
import Row from '../Row'
import { TxNotificationController, TxNotificationItemInfo } from './type'
import { spawnTimeoutControllers } from './utils'

const existMs = process.env.NODE_ENV === 'development' ? 2 * 60 * 1000 : 6 * 1000 // (ms)

const colors = {
  success: {
    heroIconName: 'check-circle',
    ring: 'ring-[#39d0d8]',
    text: 'text-[#39d0d8]',
    bg: 'bg-[#39d0d8]'
  },
  error: {
    heroIconName: 'exclamation-circle',
    ring: 'ring-[#DA2EEF]',
    text: 'text-[#DA2EEF]',
    bg: 'bg-[#e54bf9]'
  },
  info: {
    heroIconName: 'information-circle',
    ring: 'ring-[#2e7cf8]',
    text: 'text-[#2e7cf8]',
    bg: 'bg-[#92bcff]'
  },
  warning: {
    heroIconName: 'exclamation',
    ring: 'ring-[#D8CB39]',
    text: 'text-[#D8CB39]',
    bg: 'bg-[#D8CB39]'
  }
} as const

export function TxNotificationItemCard({
  info: { txInfos },
  componentRef,
  close
}: {
  componentRef: RefObject<any>
  info: TxNotificationItemInfo
  close: () => void
}) {
  const isMobile = useAppSettings((s) => s.isMobile)
  const explorerName = useAppSettings((s) => s.explorerName)
  // cache for componentRef to change it
  const [innerTxInfos, setInnerTxInfos, innerTxInfosSignal] = useSignalState(txInfos)
  const wholeItemState = innerTxInfos.every(({ state }) => state === 'success')
    ? 'success'
    : innerTxInfos.some(({ state }) => state === 'error')
    ? 'error'
    : 'info'
  const totalTransactionLength = innerTxInfos.length
  const processedTransactionLength = innerTxInfos.filter(({ state }) => state === 'success' || state === 'error').length
  const isAllProcessed = useEvent(() => {
    const txAllProcessed = processedTransactionLength === totalTransactionLength
    return txAllProcessed
  })

  useEffect(() => {
    if (wholeItemState === 'success') {
      timeoutController.current.start()
      resumeTimeline()
    }
  }, [wholeItemState])

  const [isTimePassing, { off: pauseTimeline, on: resumeTimeline }] = useToggle(false)

  const timeoutController = useRef(
    spawnTimeoutControllers({
      onEnd: close,
      totalDuration: existMs
    })
  )

  const itemRef = useRef<HTMLDivElement>(null)

  useHover(itemRef, {
    onHover({ is: now }) {
      if (!isAllProcessed()) return
      if (now === 'start') {
        timeoutController.current.pause()
        pauseTimeline()
      } else {
        timeoutController.current.resume()
        resumeTimeline()
      }
    }
  })

  useImperativeHandle(
    componentRef,
    () =>
      ({
        changeItemInfo(newInfo, { transaction: targetTransaction }) {
          const mutated = produce(innerTxInfosSignal(), (txInfos) => {
            const targetIdx = txInfos.findIndex(
              ({ transaction: candidateTransaction }) => candidateTransaction === targetTransaction
            )
            if (targetIdx < 0) {
              throw 'cannot get correct idx'
            }
            txInfos[targetIdx] = { ...txInfos[targetIdx], ...newInfo }
          })
          setInnerTxInfos(mutated)
        }
      } as TxNotificationController)
  )

  return (
    <Card
      domRef={itemRef}
      className={`min-w-[260px] relative rounded-xl ring-1.5 ring-inset ${colors[wholeItemState].ring} bg-[#1B1659] p-6 py-5 mx-4 my-2 overflow-hidden pointer-events-auto transition`}
    >
      {/* timeline */}
      <div className="h-1 absolute top-0 left-0 right-0">
        {/* track */}
        <div className={`opacity-5 ${colors[wholeItemState].bg} absolute inset-0 transition`} />
        {/* remain-line */}
        <div
          className={`${colors[wholeItemState].bg} absolute inset-0 py-`}
          style={{
            animation: `shrink ${existMs}ms linear forwards`,
            animationPlayState: isTimePassing ? 'running' : 'paused'
          }}
        />
      </div>

      <Icon
        size="smi"
        heroIconName="x"
        className="absolute right-3 top-4 clickable text-[#abc4ff]"
        onClick={() => {
          timeoutController.current.cancel()
          close()
        }}
      />
      <Row className="gap-3 px-2 mobile:px-0">
        <div>
          <Row className="gap-3 mb-5">
            <Icon heroIconName={colors[wholeItemState].heroIconName} className={colors[wholeItemState].text} />
            <div>
              <div className="font-medium text-base mobile:p-0 mobile:text-sm text-white">
                {wholeItemState === 'success'
                  ? `${innerTxInfos[0].historyInfo.title} Confirmed!`
                  : wholeItemState === 'error'
                  ? `${innerTxInfos[0].historyInfo.title} Error!`
                  : `Confirming transaction...(${processedTransactionLength + 1}/${totalTransactionLength})`}
              </div>
              <div className="font-medium text-sm mobile:text-sm text-[#abc4ff] mt-1">
                {innerTxInfos[0].historyInfo.description}
              </div>
            </div>
          </Row>
          <Col className="gap-2 mobile:gap-2 max-h-[252px] mobile:max-h-[140px] overflow-y-auto px-2 -mx-2 ">
            {innerTxInfos.map(({ state, txid }, idx) => (
              <Row key={idx} className="justify-between items-center p-3 gap-20 mobile:gap-1 bg-[#141041] rounded-lg">
                <Row className="gap-1.5">
                  {/* item icon */}
                  <div>
                    {state === 'success' ? (
                      <Icon heroIconName="check-circle" size={isMobile ? 'sm' : 'smi'} className="text-[#39d0d8]" />
                    ) : state === 'error' ? (
                      <Icon
                        heroIconName="exclamation-circle"
                        size={isMobile ? 'sm' : 'smi'}
                        className="text-[#DA2EEF]"
                      />
                    ) : (
                      <LoadingCircleSmall className="h-5 w-5 mobile:h-4 mobile:w-4 scale-75" />
                    )}
                  </div>

                  {/* item text */}
                  <div className="text-sm mobile:text-xs font-medium text-[#abc4ff]">Transaction {idx + 1}</div>
                </Row>

                <Row className="text-sm mobile:text-xs text-[#abc4ff] gap-2">
                  {txid ? (
                    <Row className="items-center gap-1.5 opacity-50 mobile:opacity-100 hover:opacity-100 transition-opacity">
                      <div>
                        View on <LinkExplorer hrefDetail={`tx/${txid}`}>{explorerName}</LinkExplorer>
                      </div>
                      <Icon heroIconName="external-link" size="xs" className="text-[#abc4ff]" />
                    </Row>
                  ) : (
                    <div className="text-[#abc4ff] text-xs opacity-50 mobile:opacity-100 transition-opacity">
                      Waiting...
                    </div>
                  )}
                </Row>
              </Row>
            ))}
          </Col>
        </div>
      </Row>
    </Card>
  )
}
