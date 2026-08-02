import { useEffect, useMemo, useState } from 'react';
import type { WorkRecord } from '../types';
import { loadArchives } from '../utils/storage';
import {
  formatHoursMinutes,
  listAvailableYearMonths,
  recordsForYearMonth,
  summarizeByCategory,
  summarizeByCategoryOption,
  summarizeByMonths,
  totalWorkMinutes,
  yearMonthFromIso,
} from '../utils/dateUtils';

interface Props {
  records: WorkRecord[];
  refreshKey?: number;
}

type ViewMode = 'month' | 'overview';

export default function SummaryTab({ records, refreshKey = 0 }: Props) {
  const archives = useMemo(() => loadArchives(), [refreshKey, records]);
  const months = useMemo(
    () => listAvailableYearMonths(records, archives),
    [records, archives]
  );

  const defaultMonth = useMemo(() => {
    const current = yearMonthFromIso(new Date().toISOString());
    if (months.includes(current)) return current;
    return months[0] ?? current;
  }, [months]);

  const [month, setMonth] = useState(defaultMonth);
  const [view, setView] = useState<ViewMode>('month');
  const [breakdown, setBreakdown] = useState<'category' | 'option'>('category');

  useEffect(() => {
    if (months.length === 0) {
      setMonth(defaultMonth);
      return;
    }
    if (!months.includes(month)) setMonth(months[0]);
  }, [months, month, defaultMonth]);

  const monthIndex = months.indexOf(month);
  const { records: monthRecords, source } = useMemo(
    () => recordsForYearMonth(month, records, archives),
    [month, records, archives]
  );
  const categoryRows = useMemo(() => summarizeByCategory(monthRecords), [monthRecords]);
  const optionRows = useMemo(() => summarizeByCategoryOption(monthRecords), [monthRecords]);
  const rows = breakdown === 'category' ? categoryRows : optionRows;
  const totalMins = totalWorkMinutes(monthRecords);

  const overviewMonths = useMemo(() => months.slice(0, 12).reverse(), [months]);
  const monthBars = useMemo(
    () => summarizeByMonths(overviewMonths, records, archives),
    [overviewMonths, records, archives]
  );
  const monthBarMax = Math.max(1, ...monthBars.map(m => m.minutes));

  const catMax = Math.max(1, ...rows.map(r => r.minutes));

  function goPrev() {
    if (monthIndex < 0 || monthIndex >= months.length - 1) return;
    setMonth(months[monthIndex + 1]);
  }

  function goNext() {
    if (monthIndex <= 0) return;
    setMonth(months[monthIndex - 1]);
  }

  return (
    <div className="summary-tab">
      <div className="summary-view-toggle" role="tablist" aria-label="集計の表示">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'month'}
          className={`summary-view-toggle__btn ${view === 'month' ? 'is-active' : ''}`}
          onClick={() => setView('month')}
        >
          月別集計
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'overview'}
          className={`summary-view-toggle__btn ${view === 'overview' ? 'is-active' : ''}`}
          onClick={() => setView('overview')}
        >
          月推移グラフ
        </button>
      </div>

      {months.length === 0 ? (
        <p className="empty-state">集計できる記録がありません。</p>
      ) : view === 'overview' ? (
        <div className="summary-overview">
          <h2 className="summary-section-title">直近の月別合計</h2>
          <div className="summary-vchart" role="img" aria-label="月別合計時間の棒グラフ">
            {monthBars.map(row => {
              const pct = Math.round((row.minutes / monthBarMax) * 100);
              return (
                <div key={row.yearMonth} className="summary-vchart__col">
                  <div className="summary-vchart__value">{formatHoursMinutes(row.minutes)}</div>
                  <div className="summary-vchart__track">
                    <div className="summary-vchart__bar" style={{ height: `${pct}%` }} />
                  </div>
                  <div className="summary-vchart__label">{row.yearMonth.replace('年', '/').replace('月', '')}</div>
                </div>
              );
            })}
          </div>
          <p className="summary-overview-hint">棒をクリックせず、上の「月別集計」で詳細を確認できます。</p>
        </div>
      ) : (
        <>
          <div className="summary-nav">
            <button
              type="button"
              className="btn-nav"
              onClick={goPrev}
              disabled={monthIndex < 0 || monthIndex >= months.length - 1}
            >
              ‹ 前月
            </button>
            <h2 className="summary-nav__label">{month}</h2>
            <button
              type="button"
              className="btn-nav"
              onClick={goNext}
              disabled={monthIndex <= 0}
            >
              次月 ›
            </button>
          </div>

          <div className="summary-total">
            <div className="summary-total__main">
              <span className="summary-total__label">月合計</span>
              <strong className="summary-total__value">{formatHoursMinutes(totalMins)}</strong>
            </div>
            <div className="summary-total__meta">
              {monthRecords.length}件
              {source === 'archive' ? ' · アーカイブ最新版から集計' : null}
              {source === 'list' ? ' · 日時一覧から集計' : null}
            </div>
          </div>

          <div className="summary-view-toggle summary-view-toggle--sub" role="tablist" aria-label="内訳">
            <button
              type="button"
              className={`summary-view-toggle__btn ${breakdown === 'category' ? 'is-active' : ''}`}
              onClick={() => setBreakdown('category')}
            >
              カテゴリ別
            </button>
            <button
              type="button"
              className={`summary-view-toggle__btn ${breakdown === 'option' ? 'is-active' : ''}`}
              onClick={() => setBreakdown('option')}
            >
              選択肢別
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="empty-state">この月の記録はありません。</p>
          ) : (
            <>
              <div className="summary-hchart" role="img" aria-label="カテゴリ別時間の横棒グラフ">
                {rows.map(row => {
                  const pct = Math.round((row.minutes / catMax) * 100);
                  const share = totalMins > 0 ? Math.round((row.minutes / totalMins) * 100) : 0;
                  return (
                    <div key={row.category} className="summary-hchart__row">
                      <div className="summary-hchart__label">{row.category}</div>
                      <div className="summary-hchart__track">
                        <div className="summary-hchart__bar" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="summary-hchart__meta">
                        {formatHoursMinutes(row.minutes)}
                        <span className="summary-hchart__pct">{share}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="summary-table-wrap">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>{breakdown === 'category' ? 'カテゴリ' : 'カテゴリ / 選択肢'}</th>
                      <th>時間</th>
                      <th>割合</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const pct = totalMins > 0 ? Math.round((row.minutes / totalMins) * 100) : 0;
                      return (
                        <tr key={row.category}>
                          <td>
                            <span className="summary-category-chip">{row.category}</span>
                          </td>
                          <td className="summary-table__time">{formatHoursMinutes(row.minutes)}</td>
                          <td className="summary-table__pct">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
