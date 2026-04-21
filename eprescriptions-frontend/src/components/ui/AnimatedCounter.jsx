import { useAnimatedCounter } from '../../hooks/useAnimatedCounter'

export default function AnimatedCounter({ value, duration = 1200, className }) {
  const { ref, value: v } = useAnimatedCounter(value, duration)
  return <span ref={ref} className={className}>{v}</span>
}
