/**
 * SkillDetailView — 共享中心 Skill 完整详情
 *
 * Tab: 概览 | 文件结构 | 参数&示例 | 评价
 */
import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import type { MarketplaceSkillDTO } from '../../../../infrastructure/api/marketplaceApiClient';

interface Props {
  skill: MarketplaceSkillDTO;
}

/* ─── Mock 完整详情数据 ─── */

const MOCK_SKILL_MD = `---
name: sql-optimizer
description: >
  分析 SQL 查询性能瓶颈，提供索引优化建议和查询重写方案
triggers:
  - 优化SQL
  - 分析查询
  - 索引建议
model: claude-sonnet-4
---

# SQL 智能优化

## Overview
专业的 SQL 查询优化工具，支持 MySQL/PostgreSQL/SQLite。

## 能力
1. **索引分析** — 识别缺失索引和冗余索引
2. **查询重写** — 将低效查询转换为高性能形式
3. **执行计划解读** — 自动解析 EXPLAIN 输出
4. **Schema 建议** — 推荐表结构优化方案

## 使用方式
直接粘贴 SQL 语句，或提供 EXPLAIN 输出。

## 限制
- 不执行 DDL/DML 操作
- 单次分析限制 5000 字符
- 需要提供表结构上下文以获得最优建议
`;

const MOCK_FILES = [
  { name: 'SKILL.md', type: 'file' as const, indent: 0, content: MOCK_SKILL_MD },
  { name: 'scripts/', type: 'folder' as const, indent: 0, content: '' },
  {
    name: 'main.py',
    type: 'file' as const,
    indent: 1,
    content: `"""SQL 优化主脚本"""
import json
from typing import Any

def execute(params: dict[str, Any]) -> dict:
    """Skill 执行入口"""
    query = params.get("query", "")
    if not query:
        return {"success": False, "error": "请提供 SQL 语句"}

    analysis = analyze_query(query)
    suggestions = generate_suggestions(analysis)

    return {
        "success": True,
        "data": {
            "analysis": analysis,
            "suggestions": suggestions,
            "optimized_query": rewrite_query(query, suggestions)
        }
    }

def analyze_query(query: str) -> dict:
    """分析查询结构"""
    return {
        "tables": extract_tables(query),
        "joins": count_joins(query),
        "has_subquery": "SELECT" in query[query.find("FROM"):] if "FROM" in query else False,
        "has_order_by": "ORDER BY" in query.upper(),
        "estimated_cost": "high" if "SELECT *" in query else "medium"
    }

def generate_suggestions(analysis: dict) -> list[str]:
    """生成优化建议"""
    suggestions = []
    if analysis.get("estimated_cost") == "high":
        suggestions.append("避免 SELECT *，只查询需要的列")
    if analysis.get("has_subquery"):
        suggestions.append("考虑将子查询改为 JOIN")
    if analysis.get("has_order_by"):
        suggestions.append("确保 ORDER BY 字段有索引覆盖")
    return suggestions

def rewrite_query(query: str, suggestions: list) -> str:
    """返回优化后的查询建议"""
    return f"-- 优化建议已生成，共 {len(suggestions)} 条\\n{query}"

def extract_tables(query: str) -> list[str]:
    return ["users", "orders"]  # simplified

def count_joins(query: str) -> int:
    return query.upper().count("JOIN")
`,
  },
  {
    name: 'utils.py',
    type: 'file' as const,
    indent: 1,
    content: `"""工具函数"""
def format_explain(explain_output: str) -> dict:
    """格式化 EXPLAIN 输出"""
    return {"formatted": explain_output, "warnings": []}
`,
  },
  { name: 'references/', type: 'folder' as const, indent: 0, content: '' },
  {
    name: 'index_guide.md',
    type: 'file' as const,
    indent: 1,
    content:
      '# 索引设计指南\n\n## 原则\n1. 高频查询字段优先建索引\n2. 复合索引遵循最左前缀\n3. 避免过多索引影响写性能',
  },
  { name: 'assets/', type: 'folder' as const, indent: 0, content: '' },
];

const MOCK_PARAMS = [
  { name: 'query', type: 'string', required: true, desc: 'SQL 查询语句' },
  {
    name: 'dialect',
    type: 'enum',
    required: false,
    desc: '数据库类型: mysql | postgresql | sqlite',
  },
  { name: 'schema', type: 'string', required: false, desc: '表结构 DDL（可选，提供后建议更精准）' },
  { name: 'explain_output', type: 'string', required: false, desc: 'EXPLAIN 执行计划输出' },
];

const MOCK_EXAMPLES = [
  {
    title: '基础查询优化',
    input: '{"query": "SELECT * FROM users WHERE name LIKE \'%张%\' ORDER BY created_at DESC"}',
    output: `{
  "success": true,
  "data": {
    "analysis": {"tables": ["users"], "estimated_cost": "high"},
    "suggestions": [
      "避免 SELECT *，只查询需要的列",
      "LIKE '%张%' 无法使用索引，考虑全文索引",
      "确保 created_at 有索引覆盖 ORDER BY"
    ],
    "optimized_query": "SELECT id, name, email FROM users WHERE name LIKE '张%' ORDER BY created_at DESC LIMIT 20"
  }
}`,
  },
  {
    title: '复杂 JOIN 优化',
    input:
      '{"query": "SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id WHERE o.amount > 100 ORDER BY o.created_at DESC", "dialect": "postgresql"}',
    output: `{
  "success": true,
  "data": {
    "analysis": {"tables": ["users", "orders"], "joins": 1, "estimated_cost": "high"},
    "suggestions": [
      "避免 SELECT u.*, o.*",
      "为 orders.user_id + orders.amount 创建复合索引",
      "为 orders.created_at 创建索引覆盖排序"
    ],
    "optimized_query": "SELECT u.id, u.name, o.id as order_id, o.amount FROM users u JOIN orders o ON u.id = o.user_id WHERE o.amount > 100 ORDER BY o.created_at DESC LIMIT 50"
  }
}`,
  },
];

type DetailTab = 'overview' | 'files' | 'params' | 'reviews';

export function SkillDetailView({ skill }: Props) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [selectedFile, setSelectedFile] = useState('SKILL.md');

  const selectedContent = MOCK_FILES.find((f) => f.name === selectedFile)?.content || '';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="px-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-1">
          {[
            { key: 'overview' as const, label: '概览' },
            { key: 'files' as const, label: '文件结构' },
            { key: 'params' as const, label: '参数 & 示例' },
            { key: 'reviews' as const, label: '评价' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-[11px] font-medium border-b-2 transition-all ${
                tab === t.key
                  ? 'text-primary border-primary'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 dcf-scrollbar">
        {/* 概览 */}
        {tab === 'overview' && (
          <div className="w-full max-w-3xl space-y-5">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: '版本', value: skill.version || 'v1.0.0' },
                { label: '作者', value: skill.author || '—' },
                { label: '分类', value: skill.category || '—' },
                { label: '下载量', value: String(skill.downloads ?? 0) },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.03]"
                >
                  <div className="text-[10px] text-slate-500">{m.label}</div>
                  <div className="text-[13px] font-medium text-slate-200 mt-0.5">{m.value}</div>
                </div>
              ))}
            </div>

            {/* 触发词 */}
            <div>
              <span className="text-[11px] font-medium text-slate-400 mb-2 block">触发词</span>
              <div className="flex flex-wrap gap-1.5">
                {['优化SQL', '分析查询', '索引建议'].map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-full text-[10px] bg-amber-500/10 text-amber-300 font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* SKILL.md 内容 */}
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-5">
              <div className="text-[11px] font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Icon name="description" size={14} className="text-slate-400" />
                SKILL.md
              </div>
              <div className="prose-sm text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-[#0d1117] rounded-xl p-4 max-h-[400px] overflow-y-auto dcf-scrollbar">
                {MOCK_SKILL_MD}
              </div>
            </div>
          </div>
        )}

        {/* 文件结构 */}
        {tab === 'files' && (
          <div className="flex gap-4 h-[calc(100vh-220px)]">
            {/* 文件树 */}
            <div className="w-48 shrink-0 border border-white/[0.08] bg-white/[0.03] rounded-xl p-2 overflow-y-auto dcf-scrollbar">
              {MOCK_FILES.map((f) => (
                <button
                  key={f.name}
                  onClick={() => f.type === 'file' && setSelectedFile(f.name)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] transition-colors ${
                    selectedFile === f.name
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-400 hover:bg-white/[0.04]'
                  }`}
                  style={{ paddingLeft: `${f.indent * 14 + 8}px` }}
                >
                  <Icon
                    name={f.type === 'folder' ? 'folder' : 'description'}
                    size={12}
                    className="inline mr-1.5"
                  />
                  {f.name}
                </button>
              ))}
            </div>
            {/* 文件内容 */}
            <div className="flex-1 border border-white/[0.08] bg-[#0d1117] rounded-xl p-4 overflow-y-auto dcf-scrollbar">
              {selectedContent ? (
                <pre className="text-[11px] font-mono text-emerald-300 leading-[1.6] whitespace-pre-wrap">
                  {selectedContent}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-[11px] text-slate-500">
                  选择文件查看内容
                </div>
              )}
            </div>
          </div>
        )}

        {/* 参数 & 示例 */}
        {tab === 'params' && (
          <div className="w-full max-w-3xl space-y-6">
            {/* 参数表 */}
            <div>
              <span className="text-[12px] font-semibold text-slate-200 mb-3 block">输入参数</span>
              <div className="border border-white/[0.08] bg-white/[0.03] rounded-xl overflow-hidden">
                <div className="grid grid-cols-[120px_80px_60px_1fr] gap-2 px-4 py-2 border-b border-white/[0.06] text-[9px] text-slate-500 font-semibold uppercase">
                  <span>名称</span>
                  <span>类型</span>
                  <span>必填</span>
                  <span>描述</span>
                </div>
                {MOCK_PARAMS.map((p) => (
                  <div
                    key={p.name}
                    className="grid grid-cols-[120px_80px_60px_1fr] gap-2 px-4 py-2.5 border-b border-white/[0.04] text-[11px]"
                  >
                    <span className="text-primary font-mono">{p.name}</span>
                    <span className="text-slate-400">{p.type}</span>
                    <span className={p.required ? 'text-red-400' : 'text-slate-500'}>
                      {p.required ? '是' : '否'}
                    </span>
                    <span className="text-slate-300">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 使用示例 */}
            <div>
              <span className="text-[12px] font-semibold text-slate-200 mb-3 block">使用示例</span>
              <div className="space-y-4">
                {MOCK_EXAMPLES.map((ex, i) => (
                  <div
                    key={i}
                    className="border border-white/[0.08] bg-white/[0.03] rounded-xl p-4"
                  >
                    <div className="text-[11px] font-medium text-slate-200 mb-2">{ex.title}</div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-semibold">
                          输入
                        </span>
                        <pre className="mt-1 p-2.5 bg-[#0d1117] rounded-lg text-[10px] font-mono text-sky-300 whitespace-pre-wrap">
                          {ex.input}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-semibold">
                          输出
                        </span>
                        <pre className="mt-1 p-2.5 bg-[#0d1117] rounded-lg text-[10px] font-mono text-emerald-300 whitespace-pre-wrap">
                          {ex.output}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 评价 */}
        {tab === 'reviews' && (
          <div className="w-full max-w-2xl space-y-4">
            <div className="flex items-center gap-4 p-4 border border-white/[0.08] bg-white/[0.03] rounded-xl">
              <div className="text-center">
                <div className="text-[28px] font-bold text-slate-100">4.6</div>
                <div className="text-[10px] text-slate-500">共 128 评价</div>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-3">{star}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${[60, 25, 10, 3, 2][5 - star]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {[
              {
                user: '张工',
                rating: 5,
                text: '查询优化建议非常精准，帮我把慢查询从 3s 优化到 200ms',
                time: '3 天前',
              },
              {
                user: '李明',
                rating: 4,
                text: '索引建议很有用，但复杂子查询的分析还可以更深入',
                time: '1 周前',
              },
              { user: 'Carol', rating: 5, text: '团队每天都在用，效率提升明显', time: '2 周前' },
            ].map((r, i) => (
              <div key={i} className="p-3 border border-white/[0.08] bg-white/[0.03] rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-slate-200">{r.user}</span>
                  <span className="text-[10px] text-slate-500">{r.time}</span>
                </div>
                <div className="text-[10px] text-amber-400 mb-1">
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}
                </div>
                <p className="text-[11px] text-slate-300">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
