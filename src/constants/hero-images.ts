/**
 * 히어로 배경 이미지 — 현지 통화(destinationCurrency)로 찾는다.
 *
 * RN 번들러는 동적 require를 못 하므로 여기에 정적으로 적어야 한다.
 * 파일은 `assets/images/hero/<nameEn 소문자>.<확장자>` (예: thailand.avif).
 * 나라 코드/영문명은 `@/constants/currencies`의 COUNTRIES 참고.
 * 없는 통화는 그냥 배경 없이(단색) 나온다 — 다 채울 필요 없다.
 */
export const HERO_IMAGES: Record<string, number> = {
  THB: require('../../assets/images/hero/thailand.avif'),
  JPY: require('../../assets/images/hero/japan.jpg'),
  VND: require('../../assets/images/hero/vietnam.jpg'),
  TWD: require('../../assets/images/hero/taiwan.jpeg'),
  PHP: require('../../assets/images/hero/philippine.jpg'),
  SGD: require('../../assets/images/hero/singapore.jpg'),
  MYR: require('../../assets/images/hero/malaysia.jpeg'),
  IDR: require('../../assets/images/hero/indonesia.jpg'),
  CNY: require('../../assets/images/hero/china.jpg'),
  USD: require('../../assets/images/hero/usa.jpg'),
  EUR: require('../../assets/images/hero/france.jpg'),
  GBP: require('../../assets/images/hero/uk.jpg'),
};
