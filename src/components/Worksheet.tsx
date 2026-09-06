import { Fragment } from 'react';
import type {
  ClockProblem,
  ColumnProblem,
  CompareProblem,
  CompareSide,
  CrosswordProblem,
  InlineProblem,
  MarkProblem,
  MoneyProblem,
  NeighborProblem,
  NumberLineProblem,
  Problem,
  SequenceProblem,
  SheetBlock,
  SheetOptions,
} from '../types';

const SIGN: Record<string, string> = { '+': '+', '-': '−', '×': '×', ':': ':' };

/** Tekst rozbity na kratki, wyrównany do prawej; spacja to pusta kratka. */
const cellsFromText = (text: string, width: number) => {
  const s = text.padStart(width, ' ').slice(-width);
  return [...s].map((c) => (c === ' ' ? '' : c));
};

const digitsOf = (n: number, width: number) => cellsFromText(String(n), width);

/** Iloczyn częściowy przesunięty o `shift` pozycji w lewo. */
const partialCells = (value: number, shift: number, width: number) =>
  cellsFromText(String(value) + ' '.repeat(shift), width);

function Inline({ problem, showAnswer }: { problem: InlineProblem; showAnswer: boolean }) {
  const blank = problem.blankIndex ?? -1;
  return (
    <span className="inline-problem">
      {problem.terms.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="op">{SIGN[problem.op]}</span>}
          {i === blank ? (
            showAnswer ? (
              <span className="answer">{t}</span>
            ) : (
              <span className="blank" />
            )
          ) : (
            <span className="term">{t}</span>
          )}
        </Fragment>
      ))}
      <span className="op">=</span>
      {blank < 0 ? (
        showAnswer ? (
          <span className="answer result">{problem.result}</span>
        ) : (
          <span className="blank" />
        )
      ) : (
        <span className="term result">{problem.result}</span>
      )}
      {problem.remainder !== undefined && (
        <>
          <span className="op">r.</span>
          {showAnswer ? (
            <span className="answer">{problem.remainder}</span>
          ) : (
            <span className="blank blank-narrow" />
          )}
        </>
      )}
    </span>
  );
}

/**
 * Szerokość kratki na odpowiedź (w cyfrach) — wspólna dla całego arkusza, żeby
 * pola były równe i żeby rozmiar pola nie podpowiadał, ile cyfr ma wynik.
 */
function blankWidth(problems: Problem[]) {
  let w = 2;
  const see = (n: number) => {
    w = Math.max(w, String(n).length);
  };
  for (const p of problems) {
    if (p.kind === 'inline') {
      see(p.result);
      p.terms.forEach(see);
    } else if (p.kind === 'sequence') {
      p.values.forEach(see);
    } else if (p.kind === 'neighbor') {
      [p.value, p.before, p.after].forEach((n) => n !== null && see(n));
    }
  }
  return w;
}

function Column({
  problem,
  showAnswer,
  grid,
  carryRow,
}: {
  problem: ColumnProblem;
  showAnswer: boolean;
  grid: boolean;
  carryRow: boolean;
}) {
  const width = Math.max(problem.answerWidth, ...problem.terms.map((t) => String(t).length));
  const partials = problem.partials && problem.partials.length > 1 ? problem.partials : null;
  return (
    <div className="column-problem" style={{ ['--cols' as string]: width }}>
      {carryRow && !showAnswer && (
        <>
          <span className="cell sign" />
          {Array.from({ length: width }, (_, i) => (
            <span className="cell carry-box" key={i} />
          ))}
        </>
      )}
      {problem.terms.map((t, row) => (
        <Fragment key={row}>
          <span className="cell sign">{row === problem.terms.length - 1 ? SIGN[problem.op] : ''}</span>
          {digitsOf(t, width).map((d, i) => (
            <span className="cell" key={i}>
              {d}
            </span>
          ))}
        </Fragment>
      ))}
      <span className="column-rule" />
      {partials?.map((value, row) => (
        <Fragment key={`p${row}`}>
          <span className="cell sign" />
          {partialCells(value, row, width).map((d, i) => (
            <span className={grid ? 'cell partial-cell box' : 'cell partial-cell'} key={i}>
              {showAnswer ? d : ''}
            </span>
          ))}
        </Fragment>
      ))}
      {partials && <span className="column-rule" />}
      <span className="cell sign" />
      {digitsOf(showAnswer ? problem.answer : 0, width).map((d, i) => (
        <span className={grid ? 'cell result-cell box' : 'cell result-cell'} key={i}>
          {showAnswer ? d : ''}
        </span>
      ))}
    </div>
  );
}

/**
 * Krzyżówka: kratki rozłożone na siatce, w której działania `a ⚬ b = c` biegną
 * poziomo i pionowo, przecinając się na wspólnych liczbach. Puste miejsca poza
 * krzyżówką nie mają ramki.
 */
function Crossword({ problem, showAnswer }: { problem: CrosswordProblem; showAnswer: boolean }) {
  return (
    <div className="crossword" style={{ ['--cw' as string]: problem.width }}>
      {problem.cells.flatMap((row, r) =>
        row.map((cell, c) => {
          const key = `${r}-${c}`;
          if (!cell) return <span className="cw-gap" key={key} data-t="" />;
          if (cell.kind === 'eq') {
            return (
              <span className="cw-cell cw-eq" key={key} data-t="e" data-v="=">
                =
              </span>
            );
          }
          const [value, type] = cell.kind === 'num' ? [String(cell.value), 'n'] : [SIGN[cell.op], 'o'];
          const classes = ['cw-cell', cell.kind === 'num' ? 'cw-num' : 'cw-op'];
          if (cell.hidden) classes.push(showAnswer ? 'answer' : 'cw-blank');
          return (
            <span
              className={classes.join(' ')}
              key={key}
              data-t={type}
              data-v={cell.kind === 'num' ? String(cell.value) : cell.op}
              data-h={cell.hidden ? '1' : undefined}
            >
              {cell.hidden && !showAnswer ? '' : value}
            </span>
          );
        }),
      )}
    </div>
  );
}

/** Porównywanie: dwie strony i kratka na znak <, > albo =. */
function Compare({ problem, showAnswer }: { problem: CompareProblem; showAnswer: boolean }) {
  const side = (s: CompareSide) =>
    s.terms.map((t, i) => (
      <Fragment key={i}>
        {i > 0 && <span className="op">{SIGN[s.op]}</span>}
        <span className="term">{t}</span>
      </Fragment>
    ));
  return (
    <span className="inline-problem">
      {side(problem.left)}
      {showAnswer ? (
        <span className="answer cmp-sign">{problem.answer}</span>
      ) : (
        <span className="blank blank-sign" />
      )}
      {side(problem.right)}
    </span>
  );
}

/** Ciąg liczbowy — zakryte wyrazy zamieniają się w kratki. */
function Sequence({ problem, showAnswer }: { problem: SequenceProblem; showAnswer: boolean }) {
  return (
    <span className="inline-problem">
      {problem.values.map((v, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="seq-sep">,</span>}
          {problem.hidden[i] ? (
            showAnswer ? (
              <span className="answer">{v}</span>
            ) : (
              <span className="blank" />
            )
          ) : (
            <span className="term">{v}</span>
          )}
        </Fragment>
      ))}
    </span>
  );
}

/** Poprzednik i następnik: kratki po bokach liczby. */
function Neighbor({ problem, showAnswer }: { problem: NeighborProblem; showAnswer: boolean }) {
  const box = (value: number) =>
    showAnswer ? <span className="answer">{value}</span> : <span className="blank" />;
  return (
    <span className="inline-problem">
      {problem.before !== null && (
        <>
          {box(problem.before)}
          <span className="op arrow">←</span>
        </>
      )}
      <span className="term">{problem.value}</span>
      {problem.after !== null && (
        <>
          <span className="op arrow">→</span>
          {box(problem.after)}
        </>
      )}
    </span>
  );
}

/** Liczby do otoczenia kółkiem; na arkuszu odpowiedzi kółka są już narysowane. */
function Mark({ problem, showAnswer }: { problem: MarkProblem; showAnswer: boolean }) {
  return (
    <span className="inline-problem mark">
      <span className="mark-label">{problem.label}:</span>
      {problem.numbers.map((n, i) => (
        <span className={showAnswer && problem.marked[i] ? 'mark-num marked' : 'mark-num'} key={i}>
          {n}
        </span>
      ))}
    </span>
  );
}

/** Punkt na tarczy zegara: kąt liczony od godziny 12, zgodnie z ruchem wskazówek. */
const polar = (deg: number, radius: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: 50 + Math.cos(a) * radius, y: 50 + Math.sin(a) * radius };
};

function Clock({ problem, showAnswer }: { problem: ClockProblem; showAnswer: boolean }) {
  // w trybie „narysuj wskazówki” tarcza jest pusta — wskazówki pojawiają się dopiero w odpowiedziach
  const hands = problem.mode === 'read' || showAnswer;
  const minute = polar(problem.minute * 6, 34);
  const hour = polar((problem.hour % 12) * 30 + problem.minute * 0.5, 23);
  return (
    <span className="clock-problem">
      <svg className="clock" viewBox="0 0 100 100">
        <circle className="clock-face" cx="50" cy="50" r="47" />
        {problem.ticks &&
          Array.from({ length: 60 }, (_, i) => {
            if (i % 5 === 0) return null;
            const a = polar(i * 6, 43);
            const b = polar(i * 6, 46.5);
            return <line className="clock-tick" key={`t${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        {Array.from({ length: 12 }, (_, i) => {
          const a = polar(i * 30, 41);
          const b = polar(i * 30, 46.5);
          return (
            <line className="clock-tick clock-tick-hour" key={`h${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          );
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          const p = polar(n * 30, 33);
          return (
            <text className="clock-num" key={`n${n}`} x={p.x} y={p.y}>
              {n}
            </text>
          );
        })}
        {hands && <line className="clock-hand clock-hand-hour" x1="50" y1="50" x2={hour.x} y2={hour.y} />}
        {hands && <line className="clock-hand clock-hand-minute" x1="50" y1="50" x2={minute.x} y2={minute.y} />}
        <circle className="clock-pin" cx="50" cy="50" r="2.6" />
      </svg>
      {problem.mode === 'read' ? (
        showAnswer ? (
          <span className="answer">{problem.label}</span>
        ) : (
          <span className="blank blank-time" />
        )
      ) : (
        <span className="term clock-label">{problem.label}</span>
      )}
    </span>
  );
}

/** Moneta albo banknot o zadanym nominale (w groszach). */
function Cash({ value }: { value: number }) {
  if (value >= 1000) {
    return (
      <svg className="note" viewBox="0 0 60 34">
        <rect className="note-body" x="1" y="1" width="58" height="32" rx="3" />
        <rect className="note-inner" x="5" y="5" width="50" height="24" rx="2" />
        <text className="cash-value" x="30" y="18">
          {value / 100} zł
        </text>
      </svg>
    );
  }
  const zloty = value >= 100;
  return (
    <svg className="coin" viewBox="0 0 34 34">
      <circle className="coin-body" cx="17" cy="17" r="16" />
      <circle className="coin-inner" cx="17" cy="17" r="12.5" />
      <text className="cash-value" x="17" y="15">
        {zloty ? value / 100 : value}
      </text>
      <text className="cash-unit" x="17" y="24">
        {zloty ? 'zł' : 'gr'}
      </text>
    </svg>
  );
}

function Money({ problem, showAnswer }: { problem: MoneyProblem; showAnswer: boolean }) {
  return (
    <span className="money-problem">
      <span className="money-items">
        {problem.items.map((v, i) => (
          <Cash key={i} value={v} />
        ))}
      </span>
      <span className="op">=</span>
      {showAnswer ? <span className="answer">{problem.label}</span> : <span className="blank blank-wide" />}
    </span>
  );
}

/**
 * Oś liczbowa: równe podziałki, opisy pod nimi, zakryte opisy jako puste kratki.
 * Odstęp podziałek dopasowuje się do najdłuższej liczby, żeby opisy się nie zlewały.
 */
function NumberLine({ problem, showAnswer }: { problem: NumberLineProblem; showAnswer: boolean }) {
  const digits = Math.max(...problem.values.map((v) => String(v).length));
  const boxWidth = Math.max(16, 7 * digits);
  const gap = boxWidth + 10;
  const margin = boxWidth / 2 + 5;
  const width = margin * 2 + (problem.values.length - 1) * gap;
  const x = (i: number) => margin + i * gap;
  return (
    <span className="numberline-wrap">
      <svg className="numberline" viewBox={`0 0 ${width} 36`} preserveAspectRatio="xMidYMid meet">
        <line className="nl-axis" x1="2" y1="12" x2={width - 4} y2="12" />
        <path className="nl-arrow" d={`M ${width - 9} 8 L ${width - 2} 12 L ${width - 9} 16 Z`} />
        {problem.values.map((v, i) => (
          <Fragment key={i}>
            <line className="nl-tick" x1={x(i)} y1="6" x2={x(i)} y2="18" />
            {problem.hidden[i] && !showAnswer ? (
              <rect className="nl-blank" x={x(i) - boxWidth / 2} y="20" width={boxWidth} height="14" rx="1" />
            ) : (
              <text className={problem.hidden[i] ? 'nl-label nl-answer' : 'nl-label'} x={x(i)} y="30">
                {v}
              </text>
            )}
          </Fragment>
        ))}
      </svg>
    </span>
  );
}

function ProblemView({
  problem,
  showAnswer,
  grid,
  carryRow,
}: {
  problem: Problem;
  showAnswer: boolean;
  grid: boolean;
  carryRow: boolean;
}) {
  switch (problem.kind) {
    case 'inline':
      return <Inline problem={problem} showAnswer={showAnswer} />;
    case 'crossword':
      return <Crossword problem={problem} showAnswer={showAnswer} />;
    case 'compare':
      return <Compare problem={problem} showAnswer={showAnswer} />;
    case 'sequence':
      return <Sequence problem={problem} showAnswer={showAnswer} />;
    case 'neighbor':
      return <Neighbor problem={problem} showAnswer={showAnswer} />;
    case 'mark':
      return <Mark problem={problem} showAnswer={showAnswer} />;
    case 'clock':
      return <Clock problem={problem} showAnswer={showAnswer} />;
    case 'money':
      return <Money problem={problem} showAnswer={showAnswer} />;
    case 'numberline':
      return <NumberLine problem={problem} showAnswer={showAnswer} />;
    default:
      return <Column problem={problem} showAnswer={showAnswer} grid={grid} carryRow={carryRow} />;
  }
}

/** Dane zadania w atrybutach — z nich korzystają skrypty sprawdzające wydruk. */
const flags = (xs: boolean[]) => xs.map((x) => (x ? 1 : 0)).join(',');

function problemData(p: Problem): Record<string, string> {
  switch (p.kind) {
    case 'crossword':
      return { 'data-kind': 'crossword', 'data-w': String(p.width), 'data-eqs': String(p.equationCount) };
    case 'compare':
      return {
        'data-kind': 'compare',
        'data-left': p.left.terms.join(p.left.op),
        'data-right': p.right.terms.join(p.right.op),
        'data-answer': p.answer,
      };
    case 'sequence':
      return {
        'data-kind': 'sequence',
        'data-values': p.values.join(','),
        'data-hidden': flags(p.hidden),
        'data-step': String(p.step),
      };
    case 'neighbor':
      return {
        'data-kind': 'neighbor',
        'data-value': String(p.value),
        'data-step': String(p.step),
        'data-before': p.before === null ? '' : String(p.before),
        'data-after': p.after === null ? '' : String(p.after),
      };
    case 'mark':
      return {
        'data-kind': 'mark',
        'data-label': p.label,
        'data-values': p.numbers.join(','),
        'data-marked': flags(p.marked),
      };
    case 'clock':
      return {
        'data-kind': 'clock',
        'data-h': String(p.hour),
        'data-m': String(p.minute),
        'data-mode': p.mode,
        'data-label': p.label,
      };
    case 'money':
      return { 'data-kind': 'money', 'data-items': p.items.join(','), 'data-total': String(p.total) };
    case 'numberline':
      return { 'data-kind': 'numberline', 'data-values': p.values.join(','), 'data-hidden': flags(p.hidden) };
    default:
      return {
        'data-kind': p.kind,
        'data-terms': p.terms.join(','),
        'data-op': p.op,
        'data-blank': String(p.kind === 'inline' ? (p.blankIndex ?? -1) : -1),
        ...(p.kind === 'inline' && p.remainder !== undefined ? { 'data-rem': String(p.remainder) } : {}),
      };
  }
}

const problemClass = (p: Problem) =>
  p.kind === 'inline' ? 'problem' : `problem problem-${p.kind}`;

interface Props {
  /** Kolejne strony arkusza; każda to lista bloków zadań. */
  pages: SheetBlock[][];
  sheet: SheetOptions;
}

/** Numer, od którego zaczyna się każdy blok — numeracja biegnie przez całą stronę. */
function blockOffsets(blocks: SheetBlock[]): number[] {
  const offsets: number[] = [];
  let n = 0;
  for (const block of blocks) {
    offsets.push(n);
    n += block.problems.length;
  }
  return offsets;
}

function Page({
  title,
  blocks,
  sheet,
  showAnswers,
}: {
  title: string;
  blocks: SheetBlock[];
  sheet: SheetOptions;
  showAnswers: boolean;
}) {
  const offsets = blockOffsets(blocks);
  return (
    <div
      className={`sheet size-${sheet.fontSize} gap-${sheet.spacing}`}
      style={{ ['--blank-w' as string]: blankWidth(blocks.flatMap((b) => b.problems)) }}
    >
      <header className="sheet-header">
        <h1>{title}</h1>
        {sheet.nameLine && !showAnswers && (
          <div className="sheet-meta">
            <span>Imię i nazwisko</span>
            <span className="sheet-meta-date">Data</span>
          </div>
        )}
      </header>
      {blocks.map((block, b) => (
        <section className="block" key={b}>
          {block.heading && <h2 className="block-heading">{block.heading}</h2>}
          <ol
            className={sheet.numbering ? 'problems' : 'problems problems-plain'}
            style={{ ['--columns' as string]: sheet.columns }}
          >
            {block.problems.map((p, i) => (
              <li key={i} className={problemClass(p)} {...problemData(p)}>
                <span className="problem-no">{offsets[b] + i + 1}.</span>
                <ProblemView
                  problem={p}
                  showAnswer={showAnswers}
                  grid={showAnswers ? false : block.grid}
                  carryRow={showAnswers ? false : block.carryRow}
                />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function Worksheet({ pages, sheet }: Props) {
  const label = (i: number) => (pages.length > 1 ? `${sheet.title} — zestaw ${i + 1}` : sheet.title);
  return (
    <div className="print-area">
      {pages.map((blocks, i) => (
        <Page key={`s${i}`} title={label(i)} blocks={blocks} sheet={sheet} showAnswers={false} />
      ))}
      {sheet.answers &&
        pages.map((blocks, i) => (
          <Page key={`a${i}`} title={`${label(i)} — odpowiedzi`} blocks={blocks} sheet={sheet} showAnswers />
        ))}
    </div>
  );
}
