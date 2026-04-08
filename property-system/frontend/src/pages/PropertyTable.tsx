/**
 * 物件テーブルビュー（スプレッドシート風）
 *
 * Excel のように物件データを一覧表示・インライン編集できる画面
 *
 * 認可: internal / admin
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getPropertiesForExport, updateProperty, createProperty } from '../api/properties';
import { PROPERTY_CATEGORIES } from '../config/propertyCategories';

const TYPE_LARGE_OPTIONS = PROPERTY_CATEGORIES.map((c) => c.type);
const TYPE_MEDIUM_MAP: Record<string, string[]> = PROPERTY_CATEGORIES.reduce(
  (acc, c) => {
    acc[c.type] = c.mediumOptions || [];
    return acc;
  },
  {} as Record<string, string[]>
);

interface PropertyRow {
  propertyId: string;
  name: string;
  zipcode: string;
  prefecture: string;
  city: string;
  address: string;
  lat?: number;
  lng?: number;
  typeLarge: string;
  typeMedium?: string;
  typeSmall?: string;
  landUse?: string;
  structure?: string;
  area?: number;
  owner?: string;
  staff?: string;
  siteStaff?: string;
  deliveryDate?: string;
  memo?: string;
}

interface ColumnDef {
  key: keyof PropertyRow;
  label: string;
  width: number;
  editable: boolean;
  type?: 'text' | 'number' | 'select';
  options?: string[];
}

const COLUMNS: ColumnDef[] = [
  { key: 'propertyId', label: '物件ID', width: 90, editable: false },
  { key: 'name', label: '物件名', width: 180, editable: true },
  { key: 'typeLarge', label: '大項目', width: 140, editable: true, type: 'select', options: TYPE_LARGE_OPTIONS },
  { key: 'typeMedium', label: '中項目', width: 120, editable: true, type: 'select' },
  { key: 'typeSmall', label: '小項目', width: 100, editable: true },
  { key: 'staff', label: '営業担当者', width: 100, editable: true },
  { key: 'siteStaff', label: '現場担当者', width: 100, editable: true },
  { key: 'owner', label: '施主', width: 120, editable: true },
  { key: 'city', label: '市区町村', width: 120, editable: true },
  { key: 'address', label: '番地', width: 160, editable: true },
  { key: 'landUse', label: '用途地域', width: 120, editable: true },
  { key: 'structure', label: '構造', width: 80, editable: true },
  { key: 'area', label: '面積', width: 70, editable: true, type: 'number' },
  { key: 'deliveryDate', label: '引渡時期', width: 90, editable: true },
  { key: 'memo', label: '備考', width: 200, editable: true },
];

type CellKey = `${string}-${string}`;

export default function PropertyTable() {
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 編集状態
  const [editingCell, setEditingCell] = useState<CellKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [savedRows, setSavedRows] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  // ソート
  const [sortKey, setSortKey] = useState<keyof PropertyRow | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const editInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // セル選択（ペースト起点）
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colKey: keyof PropertyRow } | null>(null);
  const [pastedCells, setPastedCells] = useState<Set<CellKey>>(new Set());

  // データ取得
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPropertiesForExport();
      if (response.status === 'success') {
        setRows(response.data as PropertyRow[]);
      } else {
        setError('データの取得に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // セル編集開始
  const startEdit = (rowId: string, colKey: string, currentValue: any) => {
    const key: CellKey = `${rowId}-${colKey}`;
    setEditingCell(key);
    setEditValue(currentValue != null ? String(currentValue) : '');
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  // セル編集確定
  const commitEdit = (rowId: string, colKey: keyof PropertyRow) => {
    setEditingCell(null);

    setRows((prev) =>
      prev.map((r) => {
        if (r.propertyId !== rowId) return r;
        const col = COLUMNS.find((c) => c.key === colKey);
        let newValue: any = editValue;
        if (col?.type === 'number') {
          newValue = editValue ? parseFloat(editValue) : undefined;
        }
        if (String(r[colKey] ?? '') === String(newValue ?? '')) return r;

        // 新規行のpropertyId変更時はdirtyRowsとnewRowIdsも更新
        if (colKey === 'propertyId' && newRowIds.has(rowId)) {
          const newId = String(newValue);
          setDirtyRows((d) => { const n = new Set(d); n.delete(rowId); n.add(newId); return n; });
          setNewRowIds((s) => { const n = new Set(s); n.delete(rowId); n.add(newId); return n; });
          return { ...r, propertyId: newId } as PropertyRow;
        }

        setDirtyRows((d) => new Set(d).add(rowId));
        setSavedRows((s) => { const n = new Set(s); n.delete(rowId); return n; });

        if (colKey === 'typeLarge' && newValue !== r.typeLarge) {
          return { ...r, [colKey]: newValue, typeMedium: '' } as PropertyRow;
        }
        return { ...r, [colKey]: newValue } as PropertyRow;
      })
    );
  };

  // 次の編集可能セルに移動
  const moveToNextCell = (rowId: string, colKey: keyof PropertyRow, reverse: boolean) => {
    const currentRows = sortedRows;
    const rowIdx = currentRows.findIndex((r) => r.propertyId === rowId);
    if (rowIdx === -1) return;

    const isNewRow = newRowIds.has(rowId);
    const editableCols = COLUMNS.filter((c) => c.editable || (isNewRow && c.key === 'propertyId'));
    const colIdx = editableCols.findIndex((c) => c.key === colKey);

    let nextColIdx = colIdx + (reverse ? -1 : 1);
    let nextRowIdx = rowIdx;

    if (nextColIdx >= editableCols.length) {
      nextColIdx = 0;
      nextRowIdx = rowIdx + 1;
    } else if (nextColIdx < 0) {
      nextColIdx = editableCols.length - 1;
      nextRowIdx = rowIdx - 1;
    }

    if (nextRowIdx < 0 || nextRowIdx >= currentRows.length) return;

    const nextRow = currentRows[nextRowIdx];
    const nextCol = editableCols[nextColIdx];
    if (nextRow && nextCol) {
      startEdit(nextRow.propertyId, nextCol.key, nextRow[nextCol.key]);
    }
  };

  // キーボード操作
  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, colKey: keyof PropertyRow) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(rowId, colKey);
      setTimeout(() => moveToNextCell(rowId, colKey, e.shiftKey), 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(rowId, colKey);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // 行を保存
  const saveRow = async (propertyId: string) => {
    const row = rows.find((r) => r.propertyId === propertyId);
    if (!row) return;

    setSavingRows((s) => new Set(s).add(propertyId));
    setSaveError(null);

    try {
      const { propertyId: _id, ...data } = row;
      await updateProperty(propertyId, data);
      setDirtyRows((d) => { const n = new Set(d); n.delete(propertyId); return n; });
      setSavedRows((s) => new Set(s).add(propertyId));
      setTimeout(() => setSavedRows((s) => { const n = new Set(s); n.delete(propertyId); return n; }), 2000);
    } catch (err) {
      setSaveError(`${propertyId}: ${err instanceof Error ? err.message : '保存に失敗しました'}`);
    } finally {
      setSavingRows((s) => { const n = new Set(s); n.delete(propertyId); return n; });
    }
  };

  // 全変更を保存
  const saveAll = async () => {
    setSaveError(null);
    const ids = Array.from(dirtyRows);
    for (const id of ids) {
      await saveRowAuto(id);
    }
  };

  // 中項目の選択肢を取得
  const getMediumOptions = (rowId: string): string[] => {
    const row = rows.find((r) => r.propertyId === rowId);
    if (!row?.typeLarge) return [];
    return TYPE_MEDIUM_MAP[row.typeLarge] || [];
  };

  // 新規行の仮IDセット
  const [newRowIds, setNewRowIds] = useState<Set<string>>(new Set());

  // 次の物件IDを自動生成
  const generateNextId = (): string => {
    let maxNum = 0;
    for (const r of rows) {
      const match = r.propertyId.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const next = maxNum + 1;
    const digits = String(maxNum).length;
    const padLen = Math.max(digits, 3);
    return String(next).padStart(padLen, '0');
  };

  // 新規行を追加
  const addNewRow = () => {
    const nextId = generateNextId();
    const newRow: PropertyRow = {
      propertyId: nextId,
      name: '',
      zipcode: '',
      prefecture: '',
      city: '',
      address: '',
      typeLarge: '',
    };
    setRows((prev) => [newRow, ...prev]);
    setNewRowIds((s) => new Set(s).add(nextId));
    setDirtyRows((d) => new Set(d).add(nextId));
    setSortKey('');
    setTimeout(() => startEdit(nextId, 'name', ''), 100);
  };

  // 新規行を保存（createProperty APIを使う）
  const saveNewRow = async (tempId: string) => {
    const row = rows.find((r) => r.propertyId === tempId);
    if (!row) return;

    if (!row.propertyId) { setSaveError('物件IDを入力してください'); return; }
    if (!row.name) { setSaveError('物件名を入力してください'); return; }
    if (!row.typeLarge) { setSaveError('大項目を選択してください'); return; }

    setSavingRows((s) => new Set(s).add(tempId));
    setSaveError(null);

    try {
      await createProperty({
        propertyId: row.propertyId,
        name: row.name,
        zipcode: row.zipcode || '',
        prefecture: row.prefecture || '',
        city: row.city || '',
        address: row.address || '',
        typeLarge: row.typeLarge,
        typeMedium: row.typeMedium,
        typeSmall: row.typeSmall,
        landUse: row.landUse,
        structure: row.structure,
        area: row.area,
        owner: row.owner,
        staff: row.staff,
        deliveryDate: row.deliveryDate,
        memo: row.memo,
        lat: row.lat,
        lng: row.lng,
      });

      setNewRowIds((s) => { const n = new Set(s); n.delete(tempId); return n; });
      setDirtyRows((d) => { const n = new Set(d); n.delete(tempId); return n; });
      setSavedRows((s) => new Set(s).add(row.propertyId));
      setTimeout(() => setSavedRows((s) => { const n = new Set(s); n.delete(row.propertyId); return n; }), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setSavingRows((s) => { const n = new Set(s); n.delete(tempId); return n; });
    }
  };

  // 行の保存（新規 or 更新を判定）
  const saveRowAuto = async (propertyId: string) => {
    if (newRowIds.has(propertyId)) {
      await saveNewRow(propertyId);
    } else {
      await saveRow(propertyId);
    }
  };

  // ソート切替
  const handleSort = (key: keyof PropertyRow) => {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortKey('');
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ソート済み行
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'ja');
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [rows, sortKey, sortDir]);

  // Excelからのペースト処理
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (editingCell) return;
      if (!selectedCell) return;

      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;

      e.preventDefault();

      const pasteRows = text.replace(/\r\n$/, '').replace(/\n$/, '').split(/\r\n|\n/);
      const pasteData = pasteRows.map((r) => r.split('\t'));

      const currentRows = sortedRows;
      const startRowIdx = currentRows.findIndex((r) => r.propertyId === selectedCell.rowId);
      const editableCols = COLUMNS.filter((c) => c.editable);
      const startColIdx = editableCols.findIndex((c) => c.key === selectedCell.colKey);

      if (startRowIdx === -1 || startColIdx === -1) return;

      const newPastedCells = new Set<CellKey>();
      const affectedRowIds = new Set<string>();

      setRows((prev) => {
        const updated = [...prev];
        for (let ri = 0; ri < pasteData.length; ri++) {
          if (startRowIdx + ri >= currentRows.length) break;
          const targetRow = currentRows[startRowIdx + ri];
          const actualIdx = updated.findIndex((r) => r.propertyId === targetRow.propertyId);
          if (actualIdx === -1) continue;

          for (let ci = 0; ci < pasteData[ri].length; ci++) {
            const col = editableCols[startColIdx + ci];
            if (!col) break;

            let value: any = pasteData[ri][ci].trim();
            if (col.type === 'number') {
              value = value ? parseFloat(value) : undefined;
            }

            const cellKey: CellKey = `${targetRow.propertyId}-${col.key}`;
            newPastedCells.add(cellKey);
            affectedRowIds.add(targetRow.propertyId);

            if (col.key === 'typeLarge' && value !== updated[actualIdx].typeLarge) {
              updated[actualIdx] = { ...updated[actualIdx], [col.key]: value, typeMedium: '' } as PropertyRow;
            } else {
              updated[actualIdx] = { ...updated[actualIdx], [col.key]: value } as PropertyRow;
            }
          }
        }
        return updated;
      });

      setDirtyRows((d) => {
        const n = new Set(d);
        affectedRowIds.forEach((id) => n.add(id));
        return n;
      });
      setSavedRows((s) => {
        const n = new Set(s);
        affectedRowIds.forEach((id) => n.delete(id));
        return n;
      });

      setPastedCells(newPastedCells);
      setTimeout(() => setPastedCells(new Set()), 1500);
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [selectedCell, editingCell, sortedRows]);

  // セル値の表示
  const getCellDisplay = (row: PropertyRow, col: ColumnDef): string => {
    const val = row[col.key];
    if (val == null || val === '') return '';
    return String(val);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-slate-200 z-20 flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  window.location.href = '/properties';
                }}
                className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <BackIcon className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-bold text-slate-800">テーブル編集</h1>
              <span className="text-xs text-slate-500">{rows.length} 件</span>
            </div>

            <div className="flex items-center gap-2">
              {dirtyRows.size > 0 && (
                <span className="text-xs text-amber-600 font-medium">
                  {dirtyRows.size} 件の未保存の変更
                </span>
              )}
              <button
                onClick={addNewRow}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4 mr-1.5" />
                新規追加
              </button>
              <button
                onClick={saveAll}
                disabled={dirtyRows.size === 0}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <SaveIcon className="w-4 h-4 mr-1.5" />
                すべて保存
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* エラー通知 */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-red-700">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-700 text-xs">閉じる</button>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-4" />
            <p className="text-slate-600">データを読み込み中...</p>
          </div>
        </div>
      )}

      {/* エラー */}
      {error && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button onClick={fetchData} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">再試行</button>
          </div>
        </div>
      )}

      {/* テーブル */}
      {!loading && !error && (
        <div className="flex-1 overflow-auto">
          <table className="border-collapse text-sm">
            {/* ヘッダー */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="sticky left-0 z-20 bg-slate-100 border-r border-slate-300 px-2 py-2 text-center text-xs font-semibold text-slate-500 w-10">
                  #
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="border-r border-slate-300 px-2 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap select-none cursor-pointer hover:bg-slate-200 transition-colors"
                    style={{ minWidth: col.width, width: col.width }}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        <span className="text-blue-600">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <span className="text-slate-300">⇅</span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="border-r border-slate-300 px-2 py-2 text-center text-xs font-semibold text-slate-500 w-20">
                  操作
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row, idx) => {
                const isDirty = dirtyRows.has(row.propertyId);
                const isSaving = savingRows.has(row.propertyId);
                const isSaved = savedRows.has(row.propertyId);
                const isNew = newRowIds.has(row.propertyId);

                return (
                  <tr
                    key={row.propertyId}
                    className={`border-b border-slate-200 ${
                      isNew ? 'bg-green-50' : isDirty ? 'bg-amber-50' : isSaved ? 'bg-green-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    } hover:bg-blue-50/40 transition-colors`}
                  >
                    {/* 行番号 */}
                    <td className="sticky left-0 z-10 border-r border-slate-200 px-2 py-1 text-center text-xs text-slate-400 bg-inherit">
                      {idx + 1}
                    </td>

                    {/* データセル */}
                    {COLUMNS.map((col) => {
                      const cellKey: CellKey = `${row.propertyId}-${col.key}`;
                      const isEditing = editingCell === cellKey;
                      const display = getCellDisplay(row, col);
                      const canEdit = col.editable || (isNew && col.key === 'propertyId');

                      // select列の選択肢
                      let selectOptions = col.options || [];
                      if (col.key === 'typeMedium') {
                        selectOptions = getMediumOptions(row.propertyId);
                      }

                      return (
                        <td
                          key={col.key}
                          className={`border-r border-slate-200 px-1 py-0.5 ${
                            canEdit ? 'cursor-cell' : 'cursor-default bg-slate-50/50'
                          } ${
                            pastedCells.has(`${row.propertyId}-${col.key}`) ? 'ring-2 ring-inset ring-green-400 bg-green-100' : ''
                          } ${
                            selectedCell?.rowId === row.propertyId && selectedCell?.colKey === col.key && !editingCell ? 'ring-2 ring-inset ring-blue-500' : ''
                          }`}
                          style={{ minWidth: col.width, width: col.width, maxWidth: col.width + 60 }}
                          onClick={() => {
                            if (canEdit) setSelectedCell({ rowId: row.propertyId, colKey: col.key });
                          }}
                          onDoubleClick={() => {
                            if (canEdit) startEdit(row.propertyId, col.key, row[col.key]);
                          }}
                        >
                          {isEditing ? (
                            col.type === 'select' ? (
                              <select
                                ref={(el) => { editInputRef.current = el; }}
                                value={editValue}
                                onChange={(e) => {
                                  setEditValue(e.target.value);
                                  setTimeout(() => commitEdit(row.propertyId, col.key), 0);
                                }}
                                onBlur={() => commitEdit(row.propertyId, col.key)}
                                onKeyDown={(e) => handleKeyDown(e, row.propertyId, col.key)}
                                className="w-full px-1 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                              >
                                <option value="">-</option>
                                {selectOptions.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                ref={(el) => { editInputRef.current = el; }}
                                type={col.type === 'number' ? 'number' : 'text'}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(row.propertyId, col.key)}
                                onKeyDown={(e) => handleKeyDown(e, row.propertyId, col.key)}
                                className="w-full px-1 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            )
                          ) : (
                            <span className="block truncate text-sm text-slate-700 px-1 py-0.5" title={display}>
                              {display || <span className="text-slate-300">-</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* 操作列 */}
                    <td className="border-r border-slate-200 px-1 py-0.5 text-center">
                      {isDirty && (
                        <button
                          onClick={() => saveRowAuto(row.propertyId)}
                          disabled={isSaving}
                          className={`px-2 py-0.5 text-xs font-medium text-white rounded disabled:opacity-50 transition-colors ${
                            isNew ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {isSaving ? '...' : isNew ? '登録' : '保存'}
                        </button>
                      )}
                      {isSaved && (
                        <span className="text-xs text-green-600 font-medium">&#10003;</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}
