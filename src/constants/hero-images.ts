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
  INR: require('../../assets/images/hero/india.jpg'),
  NPR: require('../../assets/images/hero/nepal.jpg'),
  MNT: require('../../assets/images/hero/mongolia.jpg'),
  AUD: require('../../assets/images/hero/australia.jpg'),
  CHF: require('../../assets/images/hero/switzerland.jpg'),
  TRY: require('../../assets/images/hero/turkey.jpg'),
  AED: require('../../assets/images/hero/dubai.jpeg'),
  EGP: require('../../assets/images/hero/egypt.jpg'),
};

export const HERO_IMAGES_BY_COUNTRY: Record<string, number> = {
  TH: require('../../assets/images/hero/thailand.avif'),
  JP: require('../../assets/images/hero/japan.jpg'),
  VN: require('../../assets/images/hero/vietnam.jpg'),
  TW: require('../../assets/images/hero/taiwan.jpeg'),
  PH: require('../../assets/images/hero/philippine.jpg'),
  SG: require('../../assets/images/hero/singapore.jpg'),
  MY: require('../../assets/images/hero/malaysia.jpeg'),
  ID: require('../../assets/images/hero/indonesia.jpg'),
  CN: require('../../assets/images/hero/china.jpg'),
  US: require('../../assets/images/hero/usa.jpg'),
  FR: require('../../assets/images/hero/france.jpg'),
  IT: require('../../assets/images/hero/italy.jpg'),
  ES: require('../../assets/images/hero/spain.jpg'),
  PT: require('../../assets/images/hero/portugal.jpg'),
  GB: require('../../assets/images/hero/uk.jpg'),
  IN: require('../../assets/images/hero/india.jpg'),
  NP: require('../../assets/images/hero/nepal.jpg'),
  MN: require('../../assets/images/hero/mongolia.jpg'),
  AU: require('../../assets/images/hero/australia.jpg'),
  CH: require('../../assets/images/hero/switzerland.jpg'),
  TR: require('../../assets/images/hero/turkey.jpg'),
  AE: require('../../assets/images/hero/dubai.jpeg'),
  EG: require('../../assets/images/hero/egypt.jpg'),
};
