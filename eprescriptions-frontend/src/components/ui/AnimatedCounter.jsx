import { useAnimatedCounter } from '../../hooks/useAnimatedCounter'

// Default 800ms con easeOutExpo (ver hook). Si la página necesita otro
// tiempo, lo puede pasar por prop.
export default function AnimatedCounter({ value, duration = 800, className }) {
  const { ref, value: v } = useAnimatedCounter(value, duration)
  return <span ref={ref} className={className}>{v}</span>
}
