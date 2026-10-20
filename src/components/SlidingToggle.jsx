/**
 * SlidingToggle - Premium segmented control with a smooth sliding indicator pill.
 * The active background pill physically glides from left to right (or right to left)
 * with a modern spring deceleration curve whenever the active selection changes.
 */
export default function SlidingToggle({
  items = [],
  value,
  onChange,
  trackClassName = '',
  pillClassName = '',
  pillStyle = {},
  btnClassName = '',
  renderItem,
  ariaLabel = 'Segmented toggle',
}) {
  const count = items.length || 1
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => String(item.id) === String(value))
  )

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative grid p-1 select-none overflow-hidden ${trackClassName}`}
      style={{
        gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
      }}
    >
      {/* Smooth Sliding Pill Indicator */}
      <div
        className={`absolute top-1 bottom-1 left-1 rounded-lg pointer-events-none ${pillClassName}`}
        style={{
          width: `calc((100% - 8px) / ${count})`,
          transform: `translateX(${selectedIndex * 100}%)`,
          transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
          ...pillStyle,
        }}
        aria-hidden="true"
      />

      {/* Interactive Item Buttons */}
      {items.map((item) => {
        const isSelected = String(value) === String(item.id)
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(item.id)}
            className={`relative z-10 flex items-center justify-center whitespace-nowrap text-center transition-colors duration-200 cursor-pointer bg-transparent border-0 outline-none ${btnClassName} ${
              isSelected ? 'font-bold' : ''
            }`}
          >
            {renderItem ? renderItem(item, isSelected) : <span>{item.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
