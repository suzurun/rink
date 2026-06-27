export type PropertyCategoryDefinition = {
  type: string;
  color: string;
  isPrimary?: boolean;
  mediumOptions?: string[];
};

export const PROPERTY_CATEGORIES: PropertyCategoryDefinition[] = [
  { type: '工場・倉庫', color: '#EF4444', isPrimary: true, mediumOptions: ['製造', '加工', '組立', '倉庫併設'] },
  { type: 'クリニック・薬局', color: '#FACC15', isPrimary: true, mediumOptions: ['クリニック', '薬局', '医療'] },
  { type: '店舗・事務所', color: '#F97316', isPrimary: true, mediumOptions: ['店舗', '事務所', 'その他'] },
  { type: '公共工事・社会福祉事業', color: '#8B5CF6', isPrimary: true, mediumOptions: ['公共工事', '社会福祉事業', 'その他'] },
  { type: '住宅', color: '#10B981', isPrimary: true, mediumOptions: ['戸建', '共同住宅'] },
  { type: '賃貸集合住宅', color: '#F97316', mediumOptions: ['分譲', '賃貸'] },
  { type: 'その他', color: '#6B7280', mediumOptions: ['その他'] },
  { type: '自社投資物件', color: '#6366F1', mediumOptions: ['自社投資物件'] },
  { type: '自社土地', color: '#92400E', mediumOptions: ['リンク', 'RBS'] },
  { type: '仲介物件', color: '#EC4899', mediumOptions: ['仲介物件'] },
];











