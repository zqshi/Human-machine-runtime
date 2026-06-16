import { Icon } from '../../../components/ui/Icon';
import { useOpenClawStore } from '../../../../application/stores/openclawStore';

interface Props {
  title: string;
  actions: Array<{ id: string; icon: string; label: string; command: string }>;
}

export function SuggestedActionsBlockComponent({ title, actions }: Props) {
  const setComposerPrefill = useOpenClawStore((s) => s.setComposerPrefill);

  if (actions.length === 0) return null;

  return (
    <div className="rounded-lg border border-primary/15 bg-primary/[0.04] p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon name="bolt" size={13} className="text-primary" />
        <span className="text-[11px] font-medium text-primary">{title}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => setComposerPrefill(action.command)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/15 bg-white/[0.06] text-[11px] text-slate-200 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors"
          >
            <Icon name={action.icon} size={13} />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
