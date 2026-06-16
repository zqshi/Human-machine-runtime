import { Icon } from './Icon';

interface AppleCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function AppleCheckbox({ checked, onChange, disabled = false }: AppleCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        checked
          ? 'bg-primary border-primary'
          : 'border-border bg-bg-white-var hover:border-primary/50'
      }`}
    >
      {checked && <Icon name="check" size={14} className="text-white" />}
    </button>
  );
}
