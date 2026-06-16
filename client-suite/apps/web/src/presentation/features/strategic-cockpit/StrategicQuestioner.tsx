/**
 * StrategicQuestioner — 苏格拉底问答交互界面
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useObjectiveStore } from '../../../application/stores/objectiveStore';

interface Question {
  id: string;
  question: string;
  category: string;
  priority: string;
  answer?: string;
}

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  measurement: { icon: 'straighten', color: 'text-blue-400' },
  risk: { icon: 'warning', color: 'text-orange-400' },
  constraint: { icon: 'block', color: 'text-red-400' },
  priority: { icon: 'priority_high', color: 'text-yellow-400' },
  division: { icon: 'people', color: 'text-purple-400' },
  timeline: { icon: 'schedule', color: 'text-green-400' },
};

export function StrategicQuestioner() {
  const { decode, decoding } = useObjectiveStore();
  const [intent, setIntent] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');

  const handleDecode = async () => {
    if (!intent.trim()) return;
    try {
      const result = await decode(intent);
      const generated: Question[] = result.questions.map((q) => ({
        id: q.id,
        question: q.question,
        category:
          q.purpose === 'measurement' ? 'measurement' : q.purpose === 'risk' ? 'risk' : 'priority',
        priority: 'high',
      }));
      setQuestions(
        generated.length > 0
          ? generated
          : [
              {
                id: 'q1',
                question: `"${intent}" 的核心成功指标是什么？`,
                category: 'measurement',
                priority: 'high',
              },
              { id: 'q2', question: '最大的不确定性在哪里？', category: 'risk', priority: 'high' },
              {
                id: 'q3',
                question: '哪些约束不可违反？',
                category: 'constraint',
                priority: 'high',
              },
            ]
      );
    } catch {
      setQuestions([
        {
          id: 'q1',
          question: `"${intent}" 的核心成功指标是什么？如何量化？`,
          category: 'measurement',
          priority: 'high',
        },
        {
          id: 'q2',
          question: '实现这一目标最大的不确定性在哪里？',
          category: 'risk',
          priority: 'high',
        },
        {
          id: 'q3',
          question: '哪些约束是绝对不可违反的？',
          category: 'constraint',
          priority: 'high',
        },
        {
          id: 'q4',
          question: '如果只能做一件事来推进这个目标，应该是什么？',
          category: 'priority',
          priority: 'medium',
        },
        {
          id: 'q5',
          question: '哪些判断必须由人来做？哪些可以委托给 AI？',
          category: 'division',
          priority: 'medium',
        },
      ]);
    }
  };

  const handleAnswer = (qId: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, answer: answerDraft } : q)));
    setAnswering(null);
    setAnswerDraft('');
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="psychology" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">战略解码</span>
        <span className="text-[10px] text-slate-500">苏格拉底模式</span>
      </div>

      {/* Intent input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleDecode()}
          placeholder="输入战略意图..."
          className="flex-1 h-8 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/40"
        />
        <button
          type="button"
          onClick={handleDecode}
          disabled={decoding}
          className="h-8 px-3 rounded-lg bg-primary/20 text-[11px] text-primary font-medium hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Icon name={decoding ? 'hourglass_empty' : 'auto_fix_high'} size={12} />
          {decoding ? '解码中...' : '解码'}
        </button>
      </div>

      {/* Questions */}
      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((q) => {
            const cat = CATEGORY_META[q.category] ?? CATEGORY_META.measurement;
            return (
              <div
                key={q.id}
                className={`rounded-lg border p-3 ${q.answer ? 'border-green-400/20 bg-green-400/[0.03]' : 'border-white/10 bg-white/[0.02]'}`}
              >
                <div className="flex items-start gap-2">
                  <Icon name={cat.icon} size={13} className={cat.color} />
                  <div className="flex-1">
                    <p className="text-[11px] text-slate-200">{q.question}</p>
                    {q.answer && (
                      <p className="text-[10px] text-green-400 mt-1 pl-1">
                        &ldquo;{q.answer}&rdquo;
                      </p>
                    )}
                  </div>
                  {!q.answer && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnswering(q.id);
                        setAnswerDraft('');
                      }}
                      className="text-[10px] text-primary hover:text-primary/80 shrink-0"
                    >
                      回答
                    </button>
                  )}
                </div>
                {answering === q.id && (
                  <div className="flex gap-2 mt-2 pl-5">
                    <input
                      type="text"
                      value={answerDraft}
                      onChange={(e) => setAnswerDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAnswer(q.id)}
                      className="flex-1 h-7 px-2 rounded bg-white/[0.04] border border-white/10 text-[10px] text-slate-200 focus:outline-none focus:border-primary/40"
                      placeholder="输入回答..."
                    />
                    <button
                      type="button"
                      onClick={() => handleAnswer(q.id)}
                      className="h-7 px-2 rounded bg-primary/20 text-[10px] text-primary"
                    >
                      确认
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
