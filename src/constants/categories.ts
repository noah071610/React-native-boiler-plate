/**
 * 기본 카테고리.
 *
 * DB의 categories.key와 1:1로 대응한다 (기본 카테고리는 name이 null이고 이름은 앱이 갖는다).
 * 빠른 기록 그리드는 스크롤 없이 4열로 전부 보여야 하므로 개수를 12칸 이내로 유지한다.
 * 여기서 늘리기 전에 "기타 뒤로 보낼 수 있는가"를 먼저 본다.
 */

export type DefaultCategory = { key: string; icon: string; labelKo: string };

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { key: 'food', icon: '🍜', labelKo: '식비' },
  { key: 'cafe', icon: '☕️', labelKo: '카페' },
  { key: 'transport', icon: '🚕', labelKo: '교통' },
  { key: 'stay', icon: '🏨', labelKo: '숙박' },
  { key: 'sightseeing', icon: '🎫', labelKo: '관광' },
  { key: 'shopping', icon: '🛍', labelKo: '쇼핑' },
  { key: 'telecom', icon: '📱', labelKo: '통신' },
  { key: 'medical', icon: '💊', labelKo: '의료' },
  { key: 'travel', icon: '✈️', labelKo: '이동' },
  { key: 'gift', icon: '🎁', labelKo: '선물' },
  { key: 'other', icon: '⋯', labelKo: '기타' },
];

const LABEL_BY_KEY = new Map(DEFAULT_CATEGORIES.map((c) => [c.key, c.labelKo]));

/** 커스텀이면 유저가 입력한 이름, 기본이면 i18n 대상 라벨. */
export function categoryLabel(category: { key: string | null; name: string | null }): string {
  return category.name ?? (category.key ? (LABEL_BY_KEY.get(category.key) ?? category.key) : '');
}
