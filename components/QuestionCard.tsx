"use client";

// One interview question, the way Claude Code asks: a bordered card with number-badged
// options (bold label + dim description), a ❯ pointer on the highlighted row, and a
// "write your own" input. Arrow keys move · number keys pick · ↵ selects.
//
// Two modes:
//  · single (default) — selecting an option answers immediately.
//  · multi  — space/number/click toggle options; a Done button (or ⌘/Ctrl+↵) submits the set.
// Options may carry a `group` (provider sub-header) and a `swatch` (color dot).

import { Fragment, useEffect, useRef, useState } from "react";
import styles from "./QuestionCard.module.css";

export type QOption = { label: string; desc: string; group?: string; swatch?: string };

export type Question = {
  id: string;
  phase: string;
  prompt: string;
  hint?: string;
  options: QOption[];
  allowCustom?: boolean;
  customPlaceholder?: string;
  multi?: boolean;
  submitLabel?: string;
  when?: (answers: Record<string, string>) => boolean;
};

export default function QuestionCard({
  question,
  onAnswer,
}: {
  question: Question;
  onAnswer: (value: string) => void;
}) {
  const { options, allowCustom = true, multi = false } = question;
  const customIndex = allowCustom ? options.length : -1;
  const rowCount = options.length + (allowCustom ? 1 : 0);

  const [highlight, setHighlight] = useState(0);
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the card so keyboard nav works the instant it becomes active.
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const moveTo = (next: number) => {
    const idx = (next + rowCount) % rowCount;
    setHighlight(idx);
    if (idx === customIndex) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      inputRef.current?.blur();
      containerRef.current?.focus();
    }
  };

  const toggle = (idx: number) => {
    const { label } = options[idx];
    setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  };

  const submitMulti = () => {
    const picks = options.filter((o) => selected.includes(o.label)).map((o) => o.label);
    if (custom.trim()) picks.push(custom.trim());
    onAnswer(picks.length ? picks.join(", ") : "None");
  };

  const answerSingle = (idx: number) => {
    if (idx === customIndex) {
      if (custom.trim()) onAnswer(custom.trim());
      return;
    }
    onAnswer(options[idx].label);
  };

  // Activate the row at idx: toggle in multi mode, answer in single mode.
  const activate = (idx: number) => {
    if (idx === customIndex) {
      if (!multi) answerSingle(idx);
      return;
    }
    if (multi) toggle(idx);
    else answerSingle(idx);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveTo(highlight + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveTo(highlight - 1);
    } else if (multi && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submitMulti();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (multi && highlight === customIndex) submitMulti();
      else activate(highlight);
    } else if (multi && e.key === " " && highlight !== customIndex) {
      e.preventDefault();
      activate(highlight);
    } else if (highlight !== customIndex && /^[1-9]$/.test(e.key)) {
      // Number selection — but not while typing in the custom row.
      const n = Number(e.key) - 1;
      if (n < options.length) {
        e.preventDefault();
        activate(n);
      }
    }
  };

  const count = selected.length + (custom.trim() ? 1 : 0);

  return (
    <div
      className={styles.card}
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={question.prompt}
    >
      <div className={styles.phase}>{question.phase}</div>
      <h2 className={styles.prompt}>{question.prompt}</h2>
      {question.hint && <p className={styles.hint}>{question.hint}</p>}

      <div className={styles.options}>
        {options.map((opt, i) => {
          const showHeader = !!opt.group && opt.group !== options[i - 1]?.group;
          const isSelected = multi && selected.includes(opt.label);
          return (
            <Fragment key={opt.label}>
              {showHeader && <div className={styles.groupHeader}>{opt.group}</div>}
              <button
                type="button"
                className={styles.option}
                data-active={highlight === i}
                data-selected={isSelected}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => activate(i)}
              >
                <span className={styles.pointer}>❯</span>
                <span className={styles.badge}>{isSelected ? "✓" : i + 1}</span>
                <span className={styles.bodyCol}>
                  <span className={styles.label}>
                    {opt.swatch && <span className={styles.swatch} style={{ background: opt.swatch }} />}
                    {opt.label}
                  </span>
                  <span className={styles.desc}>{opt.desc}</span>
                </span>
              </button>
            </Fragment>
          );
        })}

        {allowCustom && (
          <div
            className={styles.option}
            data-active={highlight === customIndex}
            data-custom
            onMouseEnter={() => setHighlight(customIndex)}
          >
            <span className={styles.pointer}>❯</span>
            <span className={styles.badge}>＋</span>
            <span className={styles.bodyCol}>
              <input
                ref={inputRef}
                className={styles.input}
                value={custom}
                placeholder={question.customPlaceholder ?? "Write your own…"}
                onChange={(e) => setCustom(e.target.value)}
                onFocus={() => setHighlight(customIndex)}
                aria-label="Write your own answer"
              />
            </span>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.hints}>
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          {multi ? (
            <>
              <span><kbd>space</kbd> toggle</span>
              <span><kbd>⌘</kbd><kbd>↵</kbd> done</span>
            </>
          ) : (
            <>
              <span><kbd>1</kbd>–<kbd>{options.length}</kbd> pick</span>
              <span><kbd>↵</kbd> select</span>
            </>
          )}
        </div>

        {multi ? (
          <button type="button" className={styles.next} onClick={submitMulti}>
            {question.submitLabel ?? "Done"}{count ? ` · ${count}` : ""} →
          </button>
        ) : (
          <button
            type="button"
            className={styles.next}
            onClick={() => answerSingle(highlight)}
            disabled={highlight === customIndex && !custom.trim()}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
