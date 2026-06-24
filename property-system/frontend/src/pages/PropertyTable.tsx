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
  area?: number | string;
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
  group: 'main' | 'optional';
}

const COLUMNS: ColumnDef[] = [
  // 必須・主要グループ
  { key: 'propertyId', label: '物件ID', width: 90, editable: false, group: 'main' },
  { key: 'name', label: '物件名', width: 180, editable: true, group: 'main' },
  { key: 'typeLarge', label: '大項目', width: 140, editable: true, type: 'select', options: TYPE_LARGE_OPTIONS, group: 'main' },
  { key: 'typeMedium', label: '中項目', width: 120, editable: true, type: 'select', group: 'main' },
  { key: 'city', label: '市区町村', width: 120, editable: true, group: 'main' },
  { key: 'address', label: '番地', width: 160, editable: true, group: 'main' },
  { key: 'lat', label: '緯度', width: 100, editable: true, type: 'number', group: 'main' },
  { key: 'lng', label: '経度', width: 100, editable: true, type: 'number', group: 'main' },
  // 任意グループ
  { key: 'typeSmall', label: '小項目', width: 100, editable: true, group: 'optional' },
  { key: 'staff', label: '営業担当者', width: 100, editable: true, group: 'optional' },
  { key: 'siteStaff', label: '現場担当者', width: 100, editable: true, group: 'optional' },
  { key: 'owner', label: '施主', width: 120, editable: true, group: 'optional' },
  { key: 'landUse', label: '用途地域', width: 120, editable: true, group: 'optional' },
  { key: 'structure', label: '構造', width: 80, editable: true, group: 'optional' },
  { key: 'area', label: '面積', width: 70, editable: true, type: 'number', group: 'optional' },
  { key: 'deliveryDate', label: '引渡時期', width: 90, editable: true, group: 'optional' },
  { key: 'memo', label: '備考', width: 200, editable: true, group: 'optional' },
];

// 土地のみ表示のときの列セット（元Excelの8列）
// 管理番号→typeSmall / 所在地→address / 通称→name / 面積→area / 担当→staff / 概要→memo
const LAND_COLUMNS: ColumnDef[] = [
  { key: 'typeSmall', label: '管理番号', width: 110, editable: true, group: 'main' },
  { key: 'address', label: '所在地', width: 220, editable: true, group: 'main' },
  { key: 'name', label: '通称', width: 160, editable: true, group: 'main' },
  { key: 'area', label: '面積', width: 90, editable: true, group: 'main' },
  { key: 'staff', label: '担当', width: 90, editable: true, group: 'main' },
  { key: 'memo', label: '概要', width: 240, editable: true, group: 'main' },
  { key: 'lat', label: '緯度', width: 110, editable: true, type: 'number', group: 'main' },
  { key: 'lng', label: '経度', width: 110, editable: true, type: 'number', group: 'main' },
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

  // カテゴリ絞り込み（'' = すべて / '土地' = 土地のみ）
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // 表示中の列セット（土地のみ表示なら土地用8列、それ以外は全項目）
  const activeColumns = categoryFilter === '土地' ? LAND_COLUMNS : COLUMNS;
  const mainColCount = activeColumns.filter((c) => c.group === 'main').length;
  const optionalColCount = activeColumns.length - mainColCount;
  const firstOptionalKey = activeColumns.find((c) => c.group === 'optional')?.key;
  const hasOptionalGroup = optionalColCount > 0;

  // 土地データ取込（見出し名で振り分けるコピペ取込）
  const [showLandImport, setShowLandImport] = useState(false);
  const [landImportText, setLandImportText] = useState('');

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
        const col = activeColumns.find((c) => c.key === colKey);
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
    const currentRows = visibleRows;
    const rowIdx = currentRows.findIndex((r) => r.propertyId === rowId);
    if (rowIdx === -1) return;

    const isNewRow = newRowIds.has(rowId);
    const editableCols = activeColumns.filter((c) => c.editable || (isNewRow && c.key === 'propertyId'));
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
      typeLarge: categoryFilter || '',
    };
    setRows((prev) => [newRow, ...prev]);
    setNewRowIds((s) => new Set(s).add(nextId));
    setDirtyRows((d) => new Set(d).add(nextId));
    setSortKey('');
    setTimeout(() => startEdit(nextId, 'name', ''), 100);
  };

  // 土地データの貼り付けを「見出し名」で振り分けて取り込む
  // （元のExcelの並び順そのままでOK。大項目=土地・市区町村=浜松市中央区を自動セット）
  const parseLandPaste = (text: string): PropertyRow[] => {
    const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const hasNames = /管理番号|所在地|通称|緯度|経度|面積|担当|概要|物件名/.test(firstLine);
    const hasCoordNumber = /\d{1,3}\.\d{3,}/.test(firstLine);
    // 1行目が列名（座標数値を含まない見出し）なら見出し行とみなす
    const isHeaderRow = hasNames && !hasCoordNumber;

    let idx: { mng: number; addr: number; name: number; area: number; staff: number; memo: number; lat: number; lng: number };

    if (isHeaderRow) {
      const header = firstLine.split('\t').map((h) => h.trim().replace(/[\s　]/g, ''));
      const find = (...names: string[]) =>
        header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
      idx = {
        mng: find('管理番号'), addr: find('所在地', '住所', '番地'), name: find('通称', '物件名'),
        area: find('面積'), staff: find('担当者', '担当'), memo: find('概要', '備考'),
        lat: find('緯度'), lng: find('経度'),
      };
    } else {
      // 見出し無し → 元Excelの並び（管理番号,所在地,通称,面積,担当,概要,…,緯度,経度）
      // 緯度・経度は末尾2列とみなす
      const n = firstLine.split('\t').length;
      idx = { mng: 0, addr: 1, name: 2, area: 3, staff: 4, memo: 5, lat: n - 2, lng: n - 1 };
    }

    let maxNum = 0;
    for (const r of rows) {
      const m = r.propertyId.match(/(\d+)/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    const padLen = Math.max(String(maxNum).length, 3);

    const out: PropertyRow[] = [];
    let seq = 0;
    const startIdx = isHeaderRow ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      const get = (k: number) => (k >= 0 && k < cols.length ? cols[k].trim() : '');
      const mng = get(idx.mng);
      const addrRaw = get(idx.addr);
      const tsusho = get(idx.name);
      const latStr = get(idx.lat);
      const lngStr = get(idx.lng);
      if (!mng && !addrRaw && !tsusho && !latStr) continue;

      const addr = addrRaw.replace(/[\s　]*外\s*\d+\s*筆.*/, '').trim();
      const areaStr = get(idx.area); // 「180.41坪」などをそのまま保持
      const gaiyo = get(idx.memo);
      const latNum = latStr ? parseFloat(latStr) : undefined;
      const lngNum = lngStr ? parseFloat(lngStr) : undefined;

      seq += 1;
      out.push({
        propertyId: String(maxNum + seq).padStart(padLen, '0'),
        name: tsusho || mng || addr,
        zipcode: '',
        prefecture: '',
        city: '浜松市中央区',
        address: addr,
        lat: latNum != null && !isNaN(latNum) ? latNum : undefined,
        lng: lngNum != null && !isNaN(lngNum) ? lngNum : undefined,
        typeLarge: '土地',
        typeSmall: mng || undefined, // 管理番号
        staff: get(idx.staff) || undefined,
        area: areaStr || undefined, // 面積（坪付きのまま文字列で）
        memo: gaiyo || undefined, // 概要
      });
    }
    return out;
  };

  // 貼り付けテキストが土地データらしいか判定（見出しあり or 末尾2列が緯度経度）
  const looksLikeLand = (text: string): boolean => {
    const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) return false;
    if (/管理番号|所在地|通称|緯度|経度/.test(lines[0]) && !/\d{1,3}\.\d{3,}/.test(lines[0])) return true;
    return lines.some((l) => {
      const c = l.split('\t');
      if (c.length < 2) return false;
      const lat = parseFloat(c[c.length - 2]);
      const lng = parseFloat(c[c.length - 1]);
      return lat >= 24 && lat <= 46 && lng >= 122 && lng <= 154;
    });
  };

  // 解析済みの行をテーブルに追加（共通処理）
  const importParsedLand = (parsed: PropertyRow[]) => {
    setRows((prev) => [...parsed, ...prev]);
    setNewRowIds((s) => { const n = new Set(s); parsed.forEach((r) => n.add(r.propertyId)); return n; });
    setDirtyRows((d) => { const n = new Set(d); parsed.forEach((r) => n.add(r.propertyId)); return n; });
    setCategoryFilter('土地');
    setSortKey('');
    setSaveError(null);
  };

  // 取込実行（モーダル用）：解析した行を新規行としてテーブルに追加
  const handleLandImport = () => {
    const parsed = parseLandPaste(landImportText);
    if (parsed.length === 0) {
      setSaveError('取り込めるデータがありませんでした（見出し行を含めて貼り付けてください）');
      return;
    }
    importParsedLand(parsed);
    setShowLandImport(false);
    setLandImportText('');
  };

  // 新規行を保存（createProperty APIを使う）
  const saveNewRow = async (tempId: string) => {
    const row = rows.find((r) => r.propertyId === tempId);
    if (!row) return;

    if (!row.propertyId) { setSaveError('物件IDを入力してください'); return; }
    // 物件名・大項目などは任意（未入力でも保存可能）

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

  // 絞り込み後の表示行（'' = すべて）
  const visibleRows = useMemo(() => {
    if (!categoryFilter) return sortedRows;
    return sortedRows.filter((r) => r.typeLarge === categoryFilter);
  }, [sortedRows, categoryFilter]);

  // Excelからのペースト処理
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (editingCell) return;

      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;

      // 土地データ（見出しあり or 末尾が緯度・経度）なら、マス選択不要で
      // テーブルに直接貼り付け→自動取込（Excelをそのまま貼ればOK）
      if (looksLikeLand(text)) {
        e.preventDefault();
        const parsed = parseLandPaste(text);
        if (parsed.length > 0) {
          importParsedLand(parsed);
        } else {
          setSaveError('土地データを取り込めませんでした。緯度・経度の列が含まれているか確認してください。');
        }
        return;
      }

      if (!selectedCell) return;

      e.preventDefault();

      const pasteRows = text.replace(/\r\n$/, '').replace(/\n$/, '').split(/\r\n|\n/);
      const pasteData = pasteRows.map((r) => r.split('\t'));

      const currentRows = visibleRows;
      const startRowIdx = currentRows.findIndex((r) => r.propertyId === selectedCell.rowId);
      const editableCols = activeColumns.filter((c) => c.editable);
      const startColIdx = editableCols.findIndex((c) => c.key === selectedCell.colKey);

      if (startRowIdx === -1 || startColIdx === -1) return;

      const newPastedCells = new Set<CellKey>();
      const affectedRowIds = new Set<string>();
      const createdRowIds: string[] = [];

      // 既存行を超えて貼り付けた分は、新規行として自動作成する
      const neededNew = Math.max(0, startRowIdx + pasteData.length - currentRows.length);
      if (neededNew > 0) {
        let maxNum = 0;
        for (const r of rows) {
          const m = r.propertyId.match(/(\d+)/);
          if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
        }
        const padLen = Math.max(String(maxNum).length, 3);
        for (let k = 0; k < neededNew; k++) {
          createdRowIds.push(String(maxNum + 1 + k).padStart(padLen, '0'));
        }
      }

      // 各貼り付け行に対応する propertyId（既存行 or 新規行）
      const targetIds: string[] = [];
      for (let ri = 0; ri < pasteData.length; ri++) {
        const idx = startRowIdx + ri;
        targetIds.push(idx < currentRows.length ? currentRows[idx].propertyId : createdRowIds[idx - currentRows.length]);
      }

      setRows((prev) => {
        const updated = [...prev];
        // 不足分の新規行を末尾に追加（絞り込み中はその大項目を初期値に）
        for (const id of createdRowIds) {
          updated.push({
            propertyId: id, name: '', zipcode: '', prefecture: '', city: '', address: '', typeLarge: categoryFilter || '',
          });
        }
        for (let ri = 0; ri < pasteData.length; ri++) {
          const pid = targetIds[ri];
          if (!pid) continue;
          const actualIdx = updated.findIndex((r) => r.propertyId === pid);
          if (actualIdx === -1) continue;

          for (let ci = 0; ci < pasteData[ri].length; ci++) {
            const col = editableCols[startColIdx + ci];
            if (!col) break;

            let value: any = pasteData[ri][ci].trim();
            if (col.type === 'number') {
              value = value ? parseFloat(value) : undefined;
            }

            const cellKey: CellKey = `${pid}-${col.key}`;
            newPastedCells.add(cellKey);
            affectedRowIds.add(pid);

            if (col.key === 'typeLarge' && value !== updated[actualIdx].typeLarge) {
              updated[actualIdx] = { ...updated[actualIdx], [col.key]: value, typeMedium: '' } as PropertyRow;
            } else {
              updated[actualIdx] = { ...updated[actualIdx], [col.key]: value } as PropertyRow;
            }
          }
        }
        return updated;
      });

      if (createdRowIds.length > 0) {
        setNewRowIds((s) => {
          const n = new Set(s);
          createdRowIds.forEach((id) => n.add(id));
          return n;
        });
      }

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
  }, [selectedCell, editingCell, visibleRows, categoryFilter, rows]);

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
              <span className="text-xs text-slate-500">
                {categoryFilter ? `${categoryFilter} ${visibleRows.length} 件` : `${rows.length} 件`}
              </span>

              {/* 表示切替（すべて / 土地のみ） */}
              <div className="ml-2 inline-flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setCategoryFilter('')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    categoryFilter === '' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  すべて
                </button>
                <button
                  onClick={() => setCategoryFilter('土地')}
                  className={`px-3 py-1.5 text-xs font-medium border-l border-slate-300 transition-colors ${
                    categoryFilter === '土地' ? 'bg-amber-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  土地のみ
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {dirtyRows.size > 0 && (
                <span className="text-xs text-amber-600 font-medium">
                  {dirtyRows.size} 件の未保存の変更
                </span>
              )}
              <button
                onClick={() => setShowLandImport(true)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-amber-700 rounded-lg hover:bg-amber-800 transition-colors"
              >
                <PlusIcon className="w-4 h-4 mr-1.5" />
                土地データ取込
              </button>
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
        <>
          {/* 直接貼り付けの案内 */}
          <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex-shrink-0">
            💡 Excelの土地データを「見出し行ごと」コピーして、この画面で <strong>⌘V</strong> すると、自動で土地として取り込まれます（マス選択不要）。
          </div>
          <div className="flex-1 overflow-auto">
          <table className="border-collapse text-sm">
            {/* ヘッダー */}
            <thead className="sticky top-0 z-10">
              {/* グループ見出し行（任意項目があるときだけ表示） */}
              {hasOptionalGroup && (
              <tr className="border-b border-slate-300">
                <th
                  colSpan={mainColCount}
                  className="bg-blue-50 border-r-4 border-slate-400 px-2 py-1.5 text-center text-xs font-bold text-blue-800"
                >
                  必須・主要項目
                </th>
                <th
                  colSpan={optionalColCount}
                  className="bg-slate-50 px-2 py-1.5 text-center text-xs font-bold text-slate-500"
                >
                  任意項目
                </th>
              </tr>
              )}
              {/* 列名行 */}
              <tr className="bg-slate-100 border-b border-slate-300">
                {activeColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-2 py-2 text-left text-xs font-semibold whitespace-nowrap select-none cursor-pointer transition-colors ${
                      col.group === 'main'
                        ? 'bg-blue-50/60 text-slate-700 hover:bg-blue-100'
                        : 'text-slate-600 hover:bg-slate-200'
                    } ${
                      col.key === firstOptionalKey
                        ? 'border-l-4 border-l-slate-400 border-r border-r-slate-300'
                        : 'border-r border-slate-300'
                    }`}
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
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row, idx) => {
                const isDirty = dirtyRows.has(row.propertyId);
                const isSaved = savedRows.has(row.propertyId);
                const isNew = newRowIds.has(row.propertyId);

                return (
                  <tr
                    key={row.propertyId}
                    className={`border-b border-slate-200 ${
                      isNew ? 'bg-green-50' : isDirty ? 'bg-amber-50' : isSaved ? 'bg-green-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    } hover:bg-blue-50/40 transition-colors`}
                  >
                    {/* データセル */}
                    {activeColumns.map((col) => {
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
                          className={`px-1 py-0.5 ${
                            col.key === firstOptionalKey ? 'border-l-4 border-l-slate-300 border-r border-r-slate-200' : 'border-r border-slate-200'
                          } ${
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
                  </tr>
                );
              })}

              {/* 空のマス（貼り付け前でも枠が見えるように） */}
              {visibleRows.length === 0 &&
                Array.from({ length: 20 }).map((_, ri) => (
                  <tr key={`placeholder-${ri}`} className={`border-b border-slate-200 ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    {activeColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`h-7 px-1 py-0.5 ${
                          col.key === firstOptionalKey ? 'border-l-4 border-l-slate-300 border-r border-r-slate-200' : 'border-r border-slate-200'
                        }`}
                        style={{ minWidth: col.width, width: col.width }}
                      />
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* 土地データ取込モーダル */}
      {showLandImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">土地データ取込（コピペ）</h2>
              <button
                onClick={() => { setShowLandImport(false); setLandImportText(''); }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-slate-600">
                Excelの表を<strong>見出し行ごとコピー</strong>して、下の枠に貼り付けてください。
                列の並びは自由です（管理番号 / 所在地 / 通称 / 面積 / 担当 / 概要 / 緯度 / 経度 を見出し名で自動判別）。
                すべて<strong>大項目＝土地</strong>・<strong>市区町村＝浜松市中央区</strong>で取り込みます。
              </p>
              <textarea
                value={landImportText}
                onChange={(e) => setLandImportText(e.target.value)}
                placeholder="ここに貼り付け（1行目は見出し行）"
                rows={10}
                className="w-full border border-slate-300 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              {landImportText.trim() !== '' && (
                <p className="text-sm text-slate-700">
                  取り込み予定：<strong className="text-amber-700">{parseLandPaste(landImportText).length} 件</strong>
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowLandImport(false); setLandImportText(''); }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleLandImport}
                disabled={parseLandPaste(landImportText).length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-700 rounded-lg hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                取り込む（確認用に表へ追加）
              </button>
            </div>
          </div>
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
