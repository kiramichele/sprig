'use client'

import { useMemo, useState } from 'react'
import Step1Basics from './step-1-basics'
import Step2Interests from './step-2-interests'
import Step3Style from './step-3-style'
import Step4Sensory from './step-4-sensory'
import Step5Photo from './step-5-photo'

type Props = {
  userId: string
  initialStep: number
}

const stepTitles = [
  'basics',
  'interests',
  'friendship style',
  'sensory preferences',
  'photo',
]

export default function OnboardingWizard({ userId, initialStep }: Props) {
  const [currentStep, setCurrentStep] = useState(initialStep)

  const activeIndex = Math.max(1, Math.min(5, currentStep))
  const StepComponent = useMemo(() => {
    switch (activeIndex) {
      case 1:
        return Step1Basics
      case 2:
        return Step2Interests
      case 3:
        return Step3Style
      case 4:
        return Step4Sensory
      case 5:
        return Step5Photo
      default:
        return Step1Basics
    }
  }, [activeIndex])

  const onComplete = () => {
    setCurrentStep((prev) => Math.min(5, prev + 1))
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-[32px] px-5 py-6 sm:p-8 shadow-[0_16px_42px_rgba(31,26,61,0.08)]">
      <style>{`
        .display { font-family: 'Caprasimo', Georgia, serif; }
        .chunky { border: 2.5px solid #1F1A3D; box-shadow: 4px 4px 0 0 #1F1A3D; transition: all 0.12s ease; }
        .chunky:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 #1F1A3D; }
        .field { border: 2.5px solid #1F1A3D; background: white; border-radius: 12px; padding: 12px 16px; font-size: 16px; width: 100%; outline: none; }
        .field:focus { box-shadow: 4px 4px 0 0 #1F1A3D; }
      `}</style>

      <div className="mb-6 sm:mb-8">
        <div className="display text-3xl sm:text-5xl mb-2" style={{ color: '#1F1A3D' }}>welcome to sprig</div>
        <p className="text-sm opacity-80" style={{ color: '#1F1A3D' }}>
          complete your profile in five quick steps so we can match you with the right friends.
        </p>
      </div>

      {/* Step indicator — numbered dots only on mobile (labels hidden); full
          numbered + labeled grid on sm+ to keep the wizard readable on phones */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-8 sm:mb-10">
        {stepTitles.map((title, index) => {
          const step = index + 1
          const isActive = step === activeIndex
          const isComplete = step < activeIndex
          return (
            <div key={title} className="text-center">
              <div
                className="mx-auto flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full font-bold text-sm sm:text-base"
                style={{
                  background: isActive ? '#FFD23F' : isComplete ? '#6BCB77' : '#F4F0E6',
                  color: '#1F1A3D',
                }}
              >
                {step}
              </div>
              <div
                className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.18em] hidden sm:block"
                style={{ color: '#1F1A3D' }}
              >
                {title}
              </div>
            </div>
          )
        })}
      </div>

      <StepComponent userId={userId} onComplete={onComplete} />
    </div>
  )
}
