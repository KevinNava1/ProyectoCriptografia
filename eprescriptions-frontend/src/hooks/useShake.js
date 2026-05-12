import { useCallback, useState } from 'react'

// Devuelve [className, trigger]. Aplica la clase CSS `.shake` durante 500ms
// y se autolimpia, lo que permite re-disparar la animación sin que React
// la "ignore" por no cambiar el className.
//
// Uso:
//   const [shakeClass, fire] = useShake()
//   <form className={shakeClass} onSubmit={(e) => { e.preventDefault();
//     if (!ok) { fire(); return toast.error('...') } }} />
export function useShake(duration = 500) {
  const [active, setActive] = useState(false)

  const trigger = useCallback(() => {
    setActive(false)
    requestAnimationFrame(() => {
      setActive(true)
      setTimeout(() => setActive(false), duration + 50)
    })
  }, [duration])

  return [active ? 'shake' : '', trigger]
}
