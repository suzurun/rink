export type PropertyCategoryDefinition = {
  type: string;
  color: string;
  isPrimary?: boolean;
  mediumOptions?: string[];
};

export const PROPERTY_CATEGORIES: PropertyCategoryDefinition[] = [
  { type: '工場', color: '#EF4444', isPrimary: true, mediumOptions: ['製造', '加工', '組立', '倉庫併設'] },
  { type: '倉庫', color: '#FACC15', isPrimary: true, mediumOptions: ['物流', '保管', '冷凍冷蔵'] },
  { type: '事務所', color: '#F97316', isPrimary: true, mediumOptions: ['一般', 'IT', '医療'] },
  { type: '店舗', color: '#8B5CF6', isPrimary: true, mediumOptions: ['飲食', '小売', 'サービス'] },
  { type: '住宅', color: '#10B981', isPrimary: true, mediumOptions: ['戸建', '共同住宅'] },
  { type: 'マンション', color: '#F97316', mediumOptions: ['分譲', '賃貸'] },
  { type: '病院', color: '#EC4899', mediumOptions: ['総合', '専門', 'クリニック'] },
  { type: '学校', color: '#6366F1', mediumOptions: ['小中高', '大学', '専門学校'] },
  { type: 'その他', color: '#6B7280', mediumOptions: ['その他'] },
];



