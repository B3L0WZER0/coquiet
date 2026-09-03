/** The coquiet wordmark: restrained typography, never an illustrated symbol. */
export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <span
      className={
        size === 'lg'
          ? 'block text-[3.5rem] leading-none font-medium tracking-[0.065em] sm:text-[clamp(5.375rem,calc(3.5rem_+_2.5vw),7.5rem)]'
          : // Larger on a phone, where it sits alone across the top; back to a
            // quiet mark at the desk, where it shares the row with the controls.
            'block text-[2.5rem] leading-none font-light tracking-[0.08em] sm:text-[1.875rem]'
      }
      style={{ color: 'var(--text-primary)', textShadow: 'var(--shadow-legible)' }}
    >
      coquiet
    </span>
  );
}
